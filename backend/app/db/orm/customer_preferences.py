from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import BaseORM
if TYPE_CHECKING: from .customer import CustomerORM


class CustomerPreferencesORM(BaseORM):
    """
    ORM for the CustomerPreferences entity.
    Stores per-customer settings (one row per customer).
    """

    # Metadata
    __tablename__ = "customer_preferences"

    # Columns
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), unique=True, index=True)
    ddt_include_quantity: Mapped[bool] = mapped_column(default=True)

    # Relationships
    customer: Mapped["CustomerORM"] = relationship(back_populates="preferences")
