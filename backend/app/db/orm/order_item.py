from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Numeric, ForeignKey, UniqueConstraint, Index, CheckConstraint

from .lot import LotORM
from .base import BaseORM
from .order import OrderORM
from .product import ProductORM


class OrderItemORM(BaseORM):
    """
    ORM for the OrderItem entity
    """

    # Metadata
    __tablename__ = "order_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_order_items_quantity_positive"), # Ensure quantity is positive
        UniqueConstraint("order_id", "product_id", name="uq_orderitem_order_product"), # Ensure unique order-product pairs
        Index("ix_order_items_order_product", "order_id", "product_id"), # Index for faster lookups
    )

    # Columns
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    quantity: Mapped[float] = mapped_column()
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2))
    lot_id: Mapped[int] = mapped_column(ForeignKey(LotORM.id, ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    order: Mapped[OrderORM] = relationship(back_populates="items")
    product: Mapped[ProductORM] = relationship(back_populates="items")
    lot: Mapped[LotORM] = relationship(back_populates="items")