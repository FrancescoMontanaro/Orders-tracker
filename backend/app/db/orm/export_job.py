from enum import Enum
from datetime import date, datetime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Integer, Text, Date, DateTime, Enum as SAEnum, String, ForeignKey, func

from .base import BaseORM
from .user import UserORM


class ExportStatusEnum(str, Enum):
    """
    Enum for tracking the status of export jobs.
    
    - PENDING: Job is created but not yet started.
    - RUNNING: Job is currently in progress.
    - COMPLETED: Job finished successfully.
    - FAILED: Job finished with an error.
    """

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ExportFormatEnum(str, Enum):
    """
    Enum for supported export formats.
    
    - CSV: Comma-Separated Values format.
    - XLSX: Microsoft Excel format.
    """

    CSV = "csv"
    XLSX = "xlsx"


class ExportEntityEnum(str, Enum):
    """
    Enum for types of entities that can be exported.
    
    - ALL: Export all entities at once.
    - CUSTOMERS: Export customer data.
    - PRODUCTS: Export product data.
    - ORDERS: Export order data.
    - EXPENSES: Export expense data.
    - INCOMES: Export income data.
    - LOTS: Export lot data.
    - NOTES: Export note data.
    """

    ALL = "all"
    CUSTOMERS = "customers"
    PRODUCTS = "products"
    ORDERS = "orders"
    EXPENSES = "expenses"
    INCOMES = "incomes"
    LOTS = "lots"
    NOTES = "notes"


class ExportJobORM(BaseORM):
    """
    ORM for the ExportJob entity.
    Tracks asynchronous export jobs requested by users.
    """

    # Metadata
    __tablename__ = "export_jobs"

    # Columns
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey(UserORM.id, ondelete="CASCADE"), index=True, nullable=False)
    entity_type: Mapped[ExportEntityEnum] = mapped_column(SAEnum(ExportEntityEnum), nullable=False)
    format: Mapped[ExportFormatEnum] = mapped_column(SAEnum(ExportFormatEnum), nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None]   = mapped_column(Date, nullable=True)
    status: Mapped[ExportStatusEnum] = mapped_column(SAEnum(ExportStatusEnum), default=ExportStatusEnum.PENDING, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    user: Mapped[UserORM] = relationship()