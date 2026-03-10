import csv
import asyncio
import zipfile
import openpyxl
from pathlib import Path
from typing import Optional, AsyncGenerator
from datetime import date, datetime, timezone, timedelta

from sqlalchemy import select, func, asc, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.config import settings
from ....db.session import db_session
from .models import ExportJobStart, ExportJob
from .exceptions import JobAlreadyExistsException
from ....models import Pagination, ListingQueryParams
from ....db.orm.notification import NotificationTypeEnum
from .constants import ALLOWED_EXPORT_JOBS_SORTING_FIELDS, ENTITY_HEADERS, ENTITY_LABELS
from ..notifications.service import create_notification as create_notification_service
from ....db.orm.export_job import ExportJobORM, ExportStatusEnum, ExportFormatEnum, ExportEntityEnum
from .utils import (
    iter_customers,
    iter_products,
    iter_orders,
    iter_order_items,
    iter_expenses,
    iter_incomes,
    iter_lots,
    iter_notes
)


# ====================== #
# ===== Public API ===== #
# ====================== #

async def create_export_job(payload: ExportJobStart, user_id: int) -> ExportJobORM:
    """
    Persist a new export job (status = PENDING) and return it.

    Raises HTTP 409 if a job for the same entity_type is already pending or running
    for this user.

    Parameters:
    - payload (ExportJobStart): The export job parameters.
    - user_id (int): The ID of the user requesting the export.

    Returns:
    - ExportJobORM: The newly created export job.
    """

    # Create a new database session for this operation
    async with db_session() as session:
        # Reject if an active job of the same type already exists for this user
        existing = await session.scalar(
            select(ExportJobORM).where(
                ExportJobORM.user_id == user_id,
                ExportJobORM.entity_type == payload.entity_type,
                ExportJobORM.status.in_([ExportStatusEnum.PENDING, ExportStatusEnum.RUNNING])
            )
        )

        # If an existing job is found, raise a custom exception that will be translated to a 409 Conflict in the router
        if existing:
            raise JobAlreadyExistsException()

        # Create and persist the new job
        job = ExportJobORM(
            user_id = user_id,
            entity_type = payload.entity_type,
            format = payload.format,
            start_date = payload.start_date,
            end_date = payload.end_date
        )

        # Persist the job to the database
        session.add(job)

        # Commit the transaction to generate the job ID and make it available for the background task
        await session.commit()
        await session.refresh(job)

        # Return the newly created job
        return job


async def list_export_jobs(params: ListingQueryParams, user_id: int) -> Pagination[ExportJob]:
    """
    List export jobs for the given user with pagination, filtering and sorting.

    Parameters:
    - params (ListingQueryParams): The query parameters for listing jobs.
    - user_id (int): The owner's user id (always applied as a security filter).

    Returns:
    - Pagination[ExportJob]: Paginated list of export jobs.
    """

    # Compute pagination params
    page = max(1, params.page)
    size = params.size
    offset = (page - 1) * size

    # Create a new database session for this operation
    async with db_session() as session:
        # Build filter conditions
        filters = params.filters or {}
        conditions = [ExportJobORM.user_id == user_id]

        # Only apply filters for allowed fields and non-null values
        for field, value in filters.items():
            # Ignore invalid fields or null values
            if value is None or field not in ALLOWED_EXPORT_JOBS_SORTING_FIELDS:
                continue

            # Map the field name to the actual ORM column
            col = ALLOWED_EXPORT_JOBS_SORTING_FIELDS[field]
            conditions.append(col == value)

        # Base statement
        stmt = select(ExportJobORM).where(*conditions)

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await session.execute(count_stmt)).scalar_one()

        # Apply sorting
        if params.sort:
            # Only apply sorting for allowed fields, ignore invalid ones
            for sort_param in params.sort:
                if sort_param.field in ALLOWED_EXPORT_JOBS_SORTING_FIELDS:
                    col = ALLOWED_EXPORT_JOBS_SORTING_FIELDS[sort_param.field]
                    stmt = stmt.order_by(asc(col) if sort_param.order == "asc" else desc(col))
        else:
            # Default sorting by creation date desc
            stmt = stmt.order_by(desc(ExportJobORM.created_at))

        # Apply pagination
        stmt = stmt.offset(offset).limit(size)

        # Execute the query and map results to Pydantic models
        rows = (await session.execute(stmt)).scalars().all()
        items = [ExportJob.model_validate(row) for row in rows]

        # Return paginated response
        return Pagination(total=total, items=items)


async def get_export_job(job_id: int, user_id: int) -> ExportJobORM | None:
    """
    Retrieve a job only if it belongs to the given user.
    Returns None on not found or ownership mismatch.

    Parameters:
    - job_id (int): The ID of the export job to retrieve.
    - user_id (int): The owner's user id (always applied as a security filter).

    Returns:
    - ExportJobORM | None: The export job if found and owned by the user, else None.
    """

    # Create a new database session for this operation
    async with db_session() as session:
        # Retrieve the job by ID
        job = await session.get(ExportJobORM, job_id)

        # Return the job only if it exists and belongs to the user, else return None
        if not job or job.user_id != user_id:
            return None
        
        # If the job exists and belongs to the user, return it
        return job


async def run_export_job(job_id: int, exports_dir: str) -> None:
    """
    Background task: generate the export file and update job lifecycle fields.

    Flow:
        PENDING → RUNNING → COMPLETED (file written to disk)
                          → FAILED (exception message stored)

    Notes:
        - entity_type ALL and entity_type ORDERS both expand to multiple entities and therefore
          always produce either a ZIP (CSV) or a multi-sheet XLSX, never a bare CSV.
        - Synchronous file I/O (csv / openpyxl) is offloaded to a thread via asyncio.to_thread so the event loop is never blocked.

    Parameters:
    - job_id (int): The ID of the export job to run.
    - exports_dir (str): The directory where export files should be saved.
    """

    # Create a new database session for this operation
    async with db_session() as session:
        # Retrieve the job by ID
        job = await session.get(ExportJobORM, job_id)

        # If the job doesn't exist (should not happen), just return and do nothing
        if not job:
            return

        # Mark the job as running
        job.status = ExportStatusEnum.RUNNING
        job.started_at = datetime.now(timezone.utc)
        await session.commit()

        # Refresh to reload attributes expired by the commit
        await session.refresh(job)

        # Capture scalar values before any further commit expires the object again
        job_user_id = job.user_id
        job_id_val = job.id
        job_entity_label = ENTITY_LABELS.get(job.entity_type, job.entity_type.value)

        try:
            # Run the export with a timeout to prevent runaway jobs
            async with asyncio.timeout(settings.export_job_timeout_seconds):
                # Determine the entities to export:
                # - ALL expands to every individual entity (ORDER_ITEMS is included after ORDERS)
                # - ORDERS also expands to [ORDERS, ORDER_ITEMS] since the two tables are tightly coupled
                # - any other single entity remains as-is
                if job.entity_type == ExportEntityEnum.ALL:
                    entities = [e for e in ExportEntityEnum if e != ExportEntityEnum.ALL]
                elif job.entity_type == ExportEntityEnum.ORDERS:
                    entities = [ExportEntityEnum.ORDERS, ExportEntityEnum.ORDER_ITEMS]
                else:
                    entities = [job.entity_type]

                # Build the output file path and ensure the directory exists
                out_dir = Path(exports_dir)
                out_dir.mkdir(parents=True, exist_ok=True)

                # Multiple entities → ZIP (CSV) or multi-sheet XLSX
                # Single entity    → CSV or XLSX as requested
                is_multi = len(entities) > 1
                if is_multi and job.format == ExportFormatEnum.CSV:
                    file_path = str(out_dir / f"{job_id}.zip")
                    await _build_zip_csv(file_path, entities, job.start_date, job.end_date, session)
                elif is_multi or job.format == ExportFormatEnum.XLSX:
                    file_path = str(out_dir / f"{job_id}.xlsx")
                    await _build_xlsx(file_path, entities, job.start_date, job.end_date, session)
                else:
                    file_path = str(out_dir / f"{job_id}.csv")
                    await _build_csv(file_path, entities[0], job.start_date, job.end_date, session)

            # Mark the job as completed
            now = datetime.now(timezone.utc)
            job.status = ExportStatusEnum.COMPLETED
            job.completed_at = now
            job.file_path = file_path
            await session.commit()

            # Notify the user that the export is ready
            await create_notification_service(
                user_id   = job_user_id,
                type      = NotificationTypeEnum.EXPORT_COMPLETED,
                title     = "Export completato",
                message   = f"{job_entity_label}: il file è pronto, puoi scaricarlo dalla pagina Export.",
                entity_id = job_id_val,
            )

        except TimeoutError:
            # Job exceeded the configured timeout
            job.status = ExportStatusEnum.FAILED
            job.error_message = f"Job exceeded the maximum allowed duration of {settings.export_job_timeout_seconds}s"
            await session.commit()

            # Notify the user that the export failed
            await create_notification_service(
                user_id   = job_user_id,
                type      = NotificationTypeEnum.EXPORT_FAILED,
                title     = "Export fallito",
                message   = f"{job_entity_label}: l'elaborazione ha impiegato troppo tempo ed è stata interrotta automaticamente.",
                entity_id = job_id_val,
            )

        except Exception as exc:
            # Mark the job as failed and store the error message
            job.status = ExportStatusEnum.FAILED
            job.error_message = str(exc)

            # Commit the transaction to persist the failure status and error message before sending the notification
            await session.commit()

            # Notify the user that the export failed
            await create_notification_service(
                user_id   = job_user_id,
                type      = NotificationTypeEnum.EXPORT_FAILED,
                title     = "Export fallito",
                message   = f"{job_entity_label}: si è verificato un errore durante l'elaborazione. Riprova o contatta l'assistenza.",
                entity_id = job_id_val,
            )

            # Re-raise the exception to allow logging and monitoring systems to capture it, 
            # while the job status and notification have already been handled
            raise


async def expire_stale_export_jobs(timeout_seconds: int) -> None:
    """
    Mark as FAILED any PENDING or RUNNING job that has been started more than
    timeout_seconds ago without reaching a terminal state.

    Called periodically by the application watchdog (see context_manager.py).

    Parameters:
    - timeout_seconds (int): Maximum allowed duration for a single export job.
    """

    # Compute the cutoff time: jobs started before this moment are considered stale
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=timeout_seconds)

    # Create a new database session for this operation
    async with db_session() as session:
        # Find jobs that started before the cutoff and are still in a non-terminal state
        stmt = select(ExportJobORM).where(
            ExportJobORM.status.in_([ExportStatusEnum.PENDING, ExportStatusEnum.RUNNING]),
            ExportJobORM.started_at <= cutoff
        )

        # Execute the query and get the list of stale jobs
        stale_jobs = (await session.execute(stmt)).scalars().all()

        # Mark each stale job as failed
        for job in stale_jobs:
            job.status = ExportStatusEnum.FAILED
            job.error_message = f"Job exceeded the maximum allowed duration of {timeout_seconds}s and was automatically terminated"

        # Persist the changes if there are any stale jobs
        if stale_jobs:
            await session.commit()


# ========================= #
# ===== Data fetching ===== #
# ========================= #


async def _iter_entity(
    entity: ExportEntityEnum,
    start_date: Optional[date],
    end_date: Optional[date],
    session: AsyncSession
) -> AsyncGenerator[list[list], None]:
    """
    Dispatch async generator: yields row batches for the given entity type.

    Parameters:
    - entity (ExportEntityEnum): The entity to stream.
    - start_date (Optional[date]): Optional start date filter.
    - end_date (Optional[date]): Optional end date filter.
    - session (AsyncSession): The database session.
    """

    # Dispatch to the correct entity generator based on the entity type.
    match entity:
        case ExportEntityEnum.CUSTOMERS:
            async for batch in iter_customers(session):
                yield batch
        case ExportEntityEnum.PRODUCTS:
            async for batch in iter_products(session):
                yield batch
        case ExportEntityEnum.ORDERS:
            async for batch in iter_orders(session, start_date, end_date):
                yield batch
        case ExportEntityEnum.ORDER_ITEMS:
            async for batch in iter_order_items(session, start_date, end_date):
                yield batch
        case ExportEntityEnum.EXPENSES:
            async for batch in iter_expenses(session, start_date, end_date):
                yield batch
        case ExportEntityEnum.INCOMES:
            async for batch in iter_incomes(session, start_date, end_date):
                yield batch
        case ExportEntityEnum.LOTS:
            async for batch in iter_lots(session, start_date, end_date):
                yield batch
        case ExportEntityEnum.NOTES:
            async for batch in iter_notes(session, start_date, end_date):
                yield batch


# ======================== #
# ===== File writers ===== #
# ======================== #

async def _build_csv(
    file_path: str,
    entity: ExportEntityEnum,
    start_date: Optional[date],
    end_date: Optional[date],
    session: AsyncSession,
) -> None:
    """
    Build a CSV file for a single entity, fetching rows from the database in
    batches to avoid loading the entire dataset into memory at once.

    Parameters:
    - file_path (str): The output file path.
    - entity (ExportEntityEnum): The entity to export.
    - start_date (Optional[date]): Optional start date filter.
    - end_date (Optional[date]): Optional end date filter.
    - session (AsyncSession): The database session.
    """

    # Open the output file in write mode with UTF-8 encoding and create a CSV writer
    with open(file_path, "w", newline="", encoding="utf-8") as f:
        # Create a CSV writer that will write rows to the file
        writer = csv.writer(f)

        # Write the header row
        writer.writerow(ENTITY_HEADERS[entity])

        # Fetch and write rows in batches to avoid loading all data into memory at once
        async for batch in _iter_entity(entity, start_date, end_date, session):
            writer.writerows(batch)


async def _build_zip_csv(
    file_path: str,
    entities: list[ExportEntityEnum],
    start_date: Optional[date],
    end_date: Optional[date],
    session: AsyncSession,
) -> None:
    """
    Build a ZIP archive containing one CSV file per entity, fetching rows from
    the database in batches to avoid loading the entire dataset into memory at once.

    Parameters:
    - file_path (str): The output ZIP file path.
    - entities (list[ExportEntityEnum]): The entities to export, one CSV per entity.
    - start_date (Optional[date]): Optional start date filter.
    - end_date (Optional[date]): Optional end date filter.
    - session (AsyncSession): The database session.
    """

    out_dir = Path(file_path).parent
    job_stem = Path(file_path).stem
    tmp_files: list[tuple[ExportEntityEnum, str]] = []

    try:
        # Write a temporary CSV file for each entity
        for entity in entities:
            tmp_path = str(out_dir / f"_tmp_{job_stem}_{entity.value}.csv")
            await _build_csv(tmp_path, entity, start_date, end_date, session)
            tmp_files.append((entity, tmp_path))

        # Pack all CSV files into a single ZIP archive
        def _write_zip() -> None:
            with zipfile.ZipFile(file_path, "w", zipfile.ZIP_DEFLATED) as zf:
                for entity, tmp_path in tmp_files:
                    zf.write(tmp_path, arcname=f"{entity.value}.csv")

        await asyncio.to_thread(_write_zip)

    finally:
        # Remove temporary CSV files regardless of outcome
        for _, tmp_path in tmp_files:
            try:
                Path(tmp_path).unlink(missing_ok=True)
            except Exception:
                pass


async def _build_xlsx(
    file_path: str,
    entities: list[ExportEntityEnum],
    start_date: Optional[date],
    end_date: Optional[date],
    session: AsyncSession,
) -> None:
    """
    Build a multi-sheet XLSX file, fetching rows from the database in batches.
    Uses openpyxl write-only mode to reduce memory footprint.

    Parameters:
    - file_path (str): The output file path.
    - entities (list[ExportEntityEnum]): The entities to export, one sheet per entity.
    - start_date (Optional[date]): Optional start date filter.
    - end_date (Optional[date]): Optional end date filter.
    - session (AsyncSession): The database session.
    """

    # Write-only mode streams rows directly through an internal buffer, avoiding
    # the need to hold the full workbook in memory
    wb = openpyxl.Workbook(write_only=True)

    # For each entity, create a new sheet and write rows in batches to avoid loading all data into memory at once
    for entity in entities:
        # Create a new sheet for this entity (openpyxl automatically handles sheet naming conflicts by appending a number)
        ws = wb.create_sheet(title=entity.value)

        # Write the header row for this sheet
        ws.append(ENTITY_HEADERS[entity])

        # Fetch and append rows in batches to avoid loading all data into memory at once
        async for batch in _iter_entity(entity, start_date, end_date, session):
            for row in batch:
                ws.append([v if v is not None else "" for v in row])

    # Flush the workbook to disk in a thread to avoid blocking the event loop
    await asyncio.to_thread(wb.save, file_path)