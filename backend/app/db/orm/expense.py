from datetime import date
from sqlalchemy import String, Numeric, Date
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseORM


class ExpenseORM(BaseORM):
    """
    ORM for the Expense entity.
    """

    # Metadata
    __tablename__ = "expenses"

    # Columns
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    timestamp: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)