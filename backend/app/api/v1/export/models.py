from typing import Optional
from pydantic import BaseModel
from datetime import date, datetime

from ....db.orm.export_job import ExportStatusEnum, ExportFormatEnum, ExportEntityEnum


class ExportJobStart(BaseModel):
    """
    Payload for starting a new export job.

    Parameters:
    - entity_type: The type of entity to export (customers, products, orders, expenses, incomes, lots, notes or all).
    - format: The export format (csv or xlsx).
    - start_date: Optional start date to filter the exported data.
    - end_date: Optional end date to filter the exported data.
    """

    entity_type: ExportEntityEnum
    format: ExportFormatEnum = ExportFormatEnum.CSV
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ExportJob(BaseModel):
    """
    Representation of an export job returned via API.
    Does not expose internal fields (file_path, user_id).

    Parameters:
    - id: The unique identifier of the export job.
    - entity_type: The type of entity being exported.
    - format: The export format.
    - status: The current status of the export job.
    - start_date: The optional start date filter for the exported data.
    - end_date: The optional end date filter for the exported data.
    - created_at: The timestamp when the job was created.
    - started_at: The timestamp when the job started processing (null if not started yet).
    - completed_at: The timestamp when the job completed (null if not completed yet).
    - error_message: The error message if the job failed (null otherwise).
    """

    id: int
    entity_type: ExportEntityEnum
    format: ExportFormatEnum
    status: ExportStatusEnum
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    # Pydantic config
    class Config:
        from_attributes = True
