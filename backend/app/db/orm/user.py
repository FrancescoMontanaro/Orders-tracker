from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from ..orm.base import BaseORM

class UserORM(BaseORM):
    """
    User ORM model for the users table.
    """

    # Metadata
    __tablename__ = "users"

    # Columns
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)