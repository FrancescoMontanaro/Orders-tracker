from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseORM


class ExpenseCategoryORM(BaseORM):
    """
    ORM for the Expense Category entity.
    """

    # Metadata
    __tablename__ = "expenses_categories"

    # Columns
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    descr: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)