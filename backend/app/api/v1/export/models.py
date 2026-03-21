from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, field_validator, model_validator

from ....db.orm.export_job import ExportStatusEnum, ExportFormatEnum, ExportEntityEnum


class ExportJobStart(BaseModel):
    """
    Payload for starting a new export job.

    Parameters:
    - entity_types: The list of entities to export (at least one required, no duplicates).
    - format: The export format (csv or xlsx).
    - start_date: Optional start date to filter the exported data.
    - end_date: Optional end date to filter the exported data.
    """

    entity_types: list[ExportEntityEnum]
    format: ExportFormatEnum = ExportFormatEnum.CSV
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @field_validator("entity_types")
    @classmethod
    def validate_entity_types(cls, v: list[ExportEntityEnum]) -> list[ExportEntityEnum]:
        """
        Validates the list of entity types to export.
        
        Validation rules:
        - Must not be empty (at least one entity must be selected).
        - Must not contain duplicates.
        
        Raises:
        - ValueError if the list is empty or contains duplicates.
        """
        
        # At least one entity must be selected
        if not v:
            raise ValueError("Seleziona almeno un'entità da esportare.")

        # No duplicates
        if len(v) != len(set(v)):
            raise ValueError("La lista delle entità non può contenere duplicati.")

        return v


class ExportJob(BaseModel):
    """
    Representation of an export job returned via API.
    Does not expose internal fields (file_path, user_id).

    Parameters:
    - id: The unique identifier of the export job.
    - entity_types: The list of entities being exported.
    - format: The export format.
    - status: The current status of the export job.
    - start_date: The optional start date filter for the exported data.
    - end_date: The optional end date filter for the exported data.
    - created_at: The timestamp when the job was created.
    - started_at: The timestamp when the job started processing (null if not started yet).
    - completed_at: The timestamp when the job completed (null if not completed yet).
    - error_message: The error message if the job failed (null otherwise).
    - report_params: The optional report-specific parameters (only for report export jobs).
    """

    id: int
    entity_types: list[ExportEntityEnum]
    format: ExportFormatEnum
    status: ExportStatusEnum
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    report_params: Optional[dict] = None

    # Pydantic config
    class Config:
        from_attributes = True


# Set of entity type values that represent report-based exports
REPORT_ENTITY_TYPES: frozenset[ExportEntityEnum] = frozenset({
    ExportEntityEnum.REPORT_PRODUCT_SALES,
    ExportEntityEnum.REPORT_EXPENSES,
    ExportEntityEnum.REPORT_INCOMES,
    ExportEntityEnum.REPORT_CUSTOMER_SALES,
    ExportEntityEnum.REPORT_CASHFLOW
})


class ExportReportJobStart(BaseModel):
    """
    Payload for starting a new report export job.

    Parameters:
    - report_type: The type of report to export (must be one of the REPORT_* entity types).
    - format: The export format (csv or xlsx).
    - start_date: Start date of the date range (required for all reports).
    - end_date: End date of the date range (required for all reports).
    - product_ids: Optional list of product IDs to filter (only for report_product_sales).
    - expense_category_ids: Optional expense category IDs (only for report_expenses).
    - income_category_ids: Optional income category IDs (only for report_incomes).
    - customer_id: Required customer ID (only for report_customer_sales).
    - include_incomes: Whether to include extra incomes in the cash flow (only for report_cashflow).
    """

    report_type: ExportEntityEnum
    format: ExportFormatEnum = ExportFormatEnum.XLSX
    start_date: date
    end_date: date
    product_ids: Optional[list[int]] = None
    expense_category_ids: Optional[list[int]] = None
    income_category_ids: Optional[list[int]] = None
    customer_id: Optional[int] = None
    include_incomes: bool = True

    @field_validator("report_type")
    @classmethod
    def validate_report_type(cls, v: ExportEntityEnum) -> ExportEntityEnum:
        """
        Ensures the report_type is one of the supported REPORT_* entity types.
        """

        # The report_type must be one of the predefined report entity types
        if v not in REPORT_ENTITY_TYPES:
            raise ValueError("Tipo di report non valido. Usa uno dei tipi report supportati.")
        
        # Return the validated value if everything is fine
        return v

    @model_validator(mode="after")
    def validate_customer_id_required(self) -> "ExportReportJobStart":
        """
        Ensures customer_id is provided when report_type is report_customer_sales.
        """

        # For the report_customer_sales report, the customer_id field is required to specify which customer's sales to export.
        if self.report_type == ExportEntityEnum.REPORT_CUSTOMER_SALES and not self.customer_id:
            raise ValueError("customer_id è obbligatorio per il report vendite per cliente.")
        
        # If validation passes, return the model instance
        return self
