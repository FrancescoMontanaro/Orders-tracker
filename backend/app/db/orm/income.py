from datetime import date
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Numeric, Date, ForeignKey

from .base import BaseORM
from .income_category import IncomesCategoryORM


class IncomeORM(BaseORM):
    """
    ORM for the Income entity.
    """

    # Metadata
    __tablename__ = "incomes"

    # Columns
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(ForeignKey(IncomesCategoryORM.id), index=True, nullable=False)
    timestamp: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)