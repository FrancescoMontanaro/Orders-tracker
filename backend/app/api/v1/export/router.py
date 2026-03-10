from pathlib import Path
from fastapi.responses import FileResponse
from typing import Optional, Dict, List, Any
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect, status

from ....db.orm.user import UserORM
from ....core.config import settings
from .models import ExportJobStart, ExportJob
from .exceptions import JobAlreadyExistsException
from ....db.orm.export_job import ExportStatusEnum
from ....core.response_models import SuccessResponse
from ....core.dependencies import get_current_user, get_ws_user
from ....core.ws_manager import export_ws_manager as ws_manager
from ....models import Pagination, SortParam, ListingQueryParams
from .service import (
    create_export_job as create_export_job_service,
    list_export_jobs as list_export_jobs_service,
    get_export_job as get_export_job_service,
    run_export_job as run_export_job_service
)


# REST router — protected by the global require_active_user dependency in main.py
router = APIRouter(prefix="/export", tags=["Export"])

# WebSocket router — no dependencies, authentication is handled inside the endpoint function
ws_router = APIRouter(prefix="/export", tags=["Export"])


# ==================== #
# ===== Export ======= #
# ==================== #

@router.post(
    path = "/list",
    response_model = SuccessResponse[Pagination[ExportJob]]
)
async def list_export_jobs(
    page: int = 1,
    size: int = 10,
    filters: Optional[Dict[str, Any]] = None,
    sort: Optional[List[SortParam]] = None,
    user: UserORM = Depends(get_current_user)
) -> SuccessResponse[Pagination[ExportJob]]:
    """
    List export jobs for the current user with pagination, filtering and sorting.

    Parameters:
    - page: The page number.
    - size: The page size.
    - filters: The filters to apply (allowed fields: status, entity_type, format, created_at).
    - sort: The sorting options.

    Returns:
    - A paginated list of export jobs belonging to the current user.
    """

    # Create the listing query parameters
    params = ListingQueryParams(page=page, size=size, filters=filters, sort=sort)

    # Call the service to list export jobs
    data = await list_export_jobs_service(params, user.id)

    # Return the success response
    return SuccessResponse(data = data)


@router.post(
    path = "/start",
    response_model = SuccessResponse[ExportJob],
    status_code = status.HTTP_202_ACCEPTED
)
async def start_export(
    payload: ExportJobStart,
    background_tasks: BackgroundTasks,
    user: UserORM = Depends(get_current_user)
) -> SuccessResponse[ExportJob]:
    """
    Start an asynchronous export job.

    Creates a job record (status = pending), enqueues the background export
    task and immediately returns the job details. Use the returned id to poll
    the status or to call the download endpoint once the job is completed.

    - **entity_type**: entity to export (orders, customers, ..., or all).
    - **format**: csv or xlsx (ignored for all — always produces multi-sheet XLSX).
    - **start_date / end_date**: optional inclusive date range filter.
    """

    # Persist the job record and enqueue the background task
    try:
        job = await create_export_job_service(payload, user.id)

    # If the user already has a pending/running job for the same entity type, return 409 Conflict
    except JobAlreadyExistsException:
        # Return a 409 Conflict response with a clear error message
        raise HTTPException(
            status_code = status.HTTP_409_CONFLICT,
            detail = "An export job for this entity type is already pending or running"
        )

    # Enqueue the background task to run the export job
    background_tasks.add_task(run_export_job_service, job.id, settings.exports_dir)

    # Return the job details
    return SuccessResponse(data=ExportJob.model_validate(job))


@router.get(
    path = "/download/{job_id}",
    status_code = status.HTTP_200_OK
)
async def download_export(
    job_id: int,
    user: UserORM = Depends(get_current_user)
) -> FileResponse:
    """
    Download the file produced by a completed export job.

    - 404: job not found or does not belong to the current user.
    - 409: job is still pending or running.
    - 422: job finished with an error.
    - 410: file has expired or was removed from disk.
    """

    # Retrieve the job, enforcing ownership
    job = await get_export_job_service(job_id, user.id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    # Job still in progress
    if job.status in (ExportStatusEnum.PENDING, ExportStatusEnum.RUNNING):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Export job is not completed yet")

    # Job failed
    if job.status == ExportStatusEnum.FAILED:
        raise HTTPException(
            status_code = status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail = "Export job failed: " + (job.error_message or ""),
        )

    # File expired or removed from disk
    if not job.file_path or not Path(job.file_path).exists():
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Export file has expired or was removed")

    # Determine media type from file extension
    ext = Path(job.file_path).suffix.lower()
    media_type = {
        ".csv":  "text/csv",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".zip":  "application/zip",
    }.get(ext, "application/octet-stream")

    # Suggest a filename for the downloaded file using all selected entity names, joined by underscore
    entities_slug = "_".join(job.entity_types) if job.entity_types else "export"
    filename = f"export_{entities_slug}_{job_id}{ext}"

    # Return the file response
    return FileResponse(path=job.file_path, media_type=media_type, filename=filename)


# ======================== #
# ===== WebSocket ======== #
# ======================== #

@ws_router.websocket(path="/ws")
async def export_jobs_ws(
    websocket: WebSocket,
    user: UserORM = Depends(get_ws_user),
) -> None:
    """
    WebSocket endpoint for real-time export job status updates.

    Authentication is performed via the `token` query parameter.
    The server pushes a JSON payload (matching the ExportJob schema) every time
    a job belonging to the authenticated user changes status.  The client does
    not need to send any messages.

    Connection URL: ws://<host>/api/export/ws?token=<access_token>
    """

    # Register the WebSocket connection for the user
    await ws_manager.connect(user.id, websocket)

    try:
        # Keep the connection alive until the client disconnects (no messages expected from the client)
        while True:
            await websocket.receive_text()

    # Handle client disconnect
    except WebSocketDisconnect:
        pass

    finally:
        # Unregister the WebSocket connection when the client disconnects
        ws_manager.disconnect(user.id, websocket)