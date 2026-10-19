from enum import Enum
from sqlalchemy import String, Boolean, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..orm.base import BaseORM


class UserRoleEnum(str, Enum):
    """
    Enumeration for user roles.

    - ADMIN: full access to the whole application.
    - EMPLOYEE: access limited to the daily deliveries summary.
    """

    ADMIN = "admin"
    EMPLOYEE = "employee"


class UserORM(BaseORM):
    """
    User ORM model for the users table.
    """

    # Metadata
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'employee')", name="check_user_role"),
    )

    # Columns
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    role: Mapped[str] = mapped_column(
        String(16),
        default = UserRoleEnum.ADMIN.value,
        server_default = UserRoleEnum.ADMIN.value,  # Pre-existing rows default to admin
        nullable = False
    )
