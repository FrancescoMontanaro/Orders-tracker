from datetime import date
from typing import TYPE_CHECKING
from sqlalchemy import String, Date, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseORM
if TYPE_CHECKING: from .order_item import OrderItemORM


class LotORM(BaseORM):
    """
    ORM for the Lot entity
    """

    # Metadata
    __tablename__ = "lots"

    # Columns
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lot_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Relationships
    items: Mapped[list["OrderItemORM"]] = relationship(back_populates="lot")