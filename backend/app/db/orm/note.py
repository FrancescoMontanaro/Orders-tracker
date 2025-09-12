from datetime import datetime
from sqlalchemy import DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseORM


class NoteORM(BaseORM):
    """
    ORM for the Note entity
    """

    # Metadata
    __tablename__ = "notes"

    # Columns
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)