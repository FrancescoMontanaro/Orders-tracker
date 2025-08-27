from sqlalchemy import String
from typing import TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseORM
if TYPE_CHECKING: from .order import OrderORM


class CustomerORM(BaseORM):
    """
    ORM for the Customer entity
    """

    # Metadata
    __tablename__ = "customers"

    # Columns
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(default=True)

    # Relationships
    orders: Mapped[list["OrderORM"]] = relationship(
        back_populates = "customer",
        cascade = "all, delete-orphan",
        passive_deletes = True
    )