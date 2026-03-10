from datetime import datetime, timezone
from sqlalchemy import select, func, asc, desc

from .models import Notification
from ....db.session import db_session
from .ws_manager import manager as ws_manager
from ....models import Pagination, ListingQueryParams
from .constants import ALLOWED_NOTIFICATIONS_SORTING_FIELDS
from ....db.orm.notification import NotificationORM, NotificationTypeEnum


# ====================== #
# ===== Public API ===== #
# ====================== #

async def list_notifications(params: ListingQueryParams, user_id: int) -> Pagination[Notification]:
    """
    List notifications for the given user with pagination, filtering and sorting.

    Parameters:
    - params (ListingQueryParams): The query parameters for listing notifications.
    - user_id (int): The owner's user id (always applied as a security filter).

    Returns:
    - Pagination[Notification]: Paginated list of notifications.
    """

    # Compute pagination params
    page = max(1, params.page)
    size = params.size
    offset = (page - 1) * size

    # Open a database session
    async with db_session() as session:
        # Build filter conditions
        filters = params.filters or {}
        conditions = [NotificationORM.user_id == user_id]

        # Only apply filters for allowed fields and non-null values
        for field, value in filters.items():
            if value is None or field not in ALLOWED_NOTIFICATIONS_SORTING_FIELDS:
                continue

            # Map field name to ORM column
            col = ALLOWED_NOTIFICATIONS_SORTING_FIELDS[field]
            conditions.append(col == value)

        # Base statement
        stmt = select(NotificationORM).where(*conditions)

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total      = (await session.execute(count_stmt)).scalar_one()

        # Apply sorting
        if params.sort:
            for sort_param in params.sort:
                if sort_param.field in ALLOWED_NOTIFICATIONS_SORTING_FIELDS:
                    col  = ALLOWED_NOTIFICATIONS_SORTING_FIELDS[sort_param.field]
                    stmt = stmt.order_by(asc(col) if sort_param.order == "asc" else desc(col))
        else:
            # Default: newest first
            stmt = stmt.order_by(desc(NotificationORM.created_at))

        # Apply pagination
        stmt = stmt.offset(offset).limit(size)

        # Execute and map
        rows  = (await session.execute(stmt)).scalars().all()
        items = [Notification.model_validate(row) for row in rows]

        # Return the paginated result
        return Pagination(total=total, items=items)


async def mark_as_read(notification_id: int, user_id: int) -> Notification | None:
    """
    Mark a single notification as read. Returns the updated notification,
    or None if not found or not owned by the user.

    Parameters:
    - notification_id (int): The ID of the notification to mark as read.
    - user_id (int): The owner's user id (always applied as a security filter).

    Returns:
    - Notification | None: The updated notification, or None if not found.
    """

    # Open a database session
    async with db_session() as session:
        # Fetch the notification by ID
        notification = await session.get(NotificationORM, notification_id)

        # Return None if not found or not owned by the requesting user
        if not notification or notification.user_id != user_id:
            return None

        # Skip update if already read
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.now(timezone.utc)

            # Persist the change
            await session.commit()
            await session.refresh(notification)

        # Return the updated notification
        return Notification.model_validate(notification)


async def mark_all_as_read(user_id: int) -> int:
    """
    Mark all unread notifications for the given user as read.

    Parameters:
    - user_id (int): The owner's user id.

    Returns:
    - int: The number of notifications marked as read.
    """

    # Open a database session
    async with db_session() as session:
        # Fetch all unread notifications for this user
        stmt = select(NotificationORM).where(
            NotificationORM.user_id == user_id,
            NotificationORM.is_read == False  # noqa: E712
        )

        # Update each notification in Python to set is_read and read_at
        rows = (await session.execute(stmt)).scalars().all()

        # Set read_at to current time for all notifications being marked as read
        now = datetime.now(timezone.utc)

        # Update each notification in Python to set is_read and read_at
        for notification in rows:
            notification.is_read = True
            notification.read_at = now

        # Persist all changes in a single transaction (committing only if there are updates)
        if rows:
            await session.commit()

        # Return the count of notifications that were marked as read
        return len(rows)


# ======================== #
# ===== Internal API ===== #
# ======================== #

async def create_notification(
    user_id : int,
    type : NotificationTypeEnum,
    title : str,
    message : str,
    entity_id : int | None = None
) -> None:
    """
    Persist a new notification for a user.
    Intended for internal use by background tasks.

    Parameters:
    - user_id (int): The recipient user's id.
    - type (NotificationTypeEnum): The notification type.
    - title (str): Short title.
    - message (str): Full notification message.
    - entity_id (int | None): Optional reference to the source entity.
    """

    # Open a database session and create the notification
    async with db_session() as session:
        notification = NotificationORM(
            user_id = user_id,
            type = type,
            title = title,
            message = message,
            entity_id = entity_id
        )

        # Persist the new notification
        session.add(notification)

        # Commit the transaction to save the notification in the database
        await session.commit()
        await session.refresh(notification)

        # Broadcast the new notification to all active WebSocket connections for this user
        await ws_manager.broadcast(
            user_id = user_id,
            payload = Notification.model_validate(notification).model_dump(mode="json"),
        )
