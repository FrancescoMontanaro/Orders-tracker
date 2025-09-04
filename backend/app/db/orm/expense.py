from datetime import date
from sqlalchemy import String, Numeric, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseORM
from .expense_category import ExpenseCategoryORM


class ExpenseORM(BaseORM):
    """
    ORM for the Expense entity.
    """

    # Metadata
    __tablename__ = "expenses"

    # Columns
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(ForeignKey(ExpenseCategoryORM.id), index=True, nullable=False)
    timestamp: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)