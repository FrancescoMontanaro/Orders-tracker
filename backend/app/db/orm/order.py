from typing import TYPE_CHECKING, Literal
from datetime import date, datetime, timezone
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Numeric, Date, DateTime, String, Text, ForeignKey, Index, CheckConstraint

from .base import BaseORM
from .customer import CustomerORM
if TYPE_CHECKING: from .order_item import OrderItemORM


class OrderORM(BaseORM):
    """
    ORM for the Order entity
    """

    # Metadata
    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_orders_delivery_date_id", "delivery_date", "id"),  # Composite index
        CheckConstraint(
            "applied_discount >= 0 AND (discount_type = 'fixed' OR applied_discount <= 100)",
            name="check_order_discount_value",
        ),
        CheckConstraint("discount_type IN ('percentage', 'fixed')", name="check_order_discount_type"),
        CheckConstraint("status IN ('created', 'delivered')", name="check_order_status")
    )

    # Columns
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey(CustomerORM.id, ondelete="RESTRICT"), index=True)
    delivery_date: Mapped[date] = mapped_column(Date, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now(timezone.utc))
    discount_type: Mapped[Literal["percentage", "fixed"]] = mapped_column(String(16), default="percentage", server_default="percentage")
    applied_discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[str] = mapped_column(String(16), default="created", nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    # Relationships
    customer: Mapped[CustomerORM] = relationship(back_populates="orders")
    items: Mapped[list["OrderItemORM"]] = relationship(
        back_populates = "order",
        cascade = "all, delete-orphan",
        passive_deletes = True
    )