from enum import Enum
from typing import TYPE_CHECKING
from sqlalchemy import String, Enum as SAEnum, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseORM
if TYPE_CHECKING: from .order_item import OrderItemORM


class UnitEnum(str, Enum):
    """
    Enumeration for product units.
    """
    
    KG = "Kg"
    PX = "Px"


class ProductORM(BaseORM):
    """
    ORM for the Product entity.
    """

    # Metadata
    __tablename__ = "products"

    # Columns
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2))
    unit: Mapped[UnitEnum] = mapped_column(SAEnum(UnitEnum))
    is_active: Mapped[bool] = mapped_column(default=True)

    # Relationships
    items: Mapped[list["OrderItemORM"]] = relationship(back_populates="product")