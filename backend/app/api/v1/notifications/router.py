from sqlalchemy import select
from typing import Optional, Dict, List, Any
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status

from .models import Notification
from ....db.orm.user import UserORM
from ....core.response_models import SuccessResponse
from ....core.dependencies import get_current_user, get_ws_user
from ....models import Pagination, SortParam, ListingQueryParams
from ....core.ws_manager import notifications_ws_manager as ws_manager
from .service import (
    list_notifications as list_notifications_service,
    mark_as_read as mark_as_read_service,
    mark_all_as_read as mark_all_as_read_service
)

# REST router — protected by the global require_active_user dependency in main.py
router = APIRouter(prefix="/notifications", tags=["Notifications"])

# WebSocket router — no dependencies, authentication is handled inside the endpoint function
ws_router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ========================== #
# ===== Notifications ====== #
# ========================== #

@router.post(
    path = "/list",
    response_model = SuccessResponse[Pagination[Notification]]
)
async def list_notifications(
    page : int = 1,
    size : int = 20,
    filters : Optional[Dict[str, Any]] = None,
    sort : Optional[List[SortParam]] = None,
    user : UserORM = Depends(get_current_user)
) -> SuccessResponse[Pagination[Notification]]:
    """
    List notifications for the current user with pagination, filtering and sorting.

    Parameters:
    - page: The page number.
    - size: The page size.
    - filters: Allowed fields: type, is_read, created_at.
    - sort: The sorting options.

    Returns:
    - A paginated list of notifications belonging to the current user.
    """

    # Create the listing query parameters
    params = ListingQueryParams(page=page, size=size, filters=filters, sort=sort)

    # Call the service to list notifications
    data = await list_notifications_service(params, user.id)

    # Return the success response
    return SuccessResponse(data=data)


@router.post(
    path = "/read/{notification_id}",
    response_model = SuccessResponse[Notification]
)
async def mark_notification_as_read(
    notification_id : int,
    user : UserORM = Depends(get_current_user)
) -> SuccessResponse[Notification]:
    """
    Mark a single notification as read.

    Parameters:
    - notification_id: The ID of the notification to mark as read.

    Returns:
    - The updated notification.
    """

    # Call the service to mark the notification as read
    notification = await mark_as_read_service(notification_id, user.id)

    # If the notification was not found or does not belong to the user, raise 404
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    # Return the success response with the updated notification
    return SuccessResponse(data=notification)


@router.post(
    path = "/read-all",
    response_model = SuccessResponse[dict]
)
async def mark_all_notifications_as_read(
    user: UserORM = Depends(get_current_user)
) -> SuccessResponse[dict]:
    """
    Mark all unread notifications for the current user as read.

    Returns:
    - The number of notifications marked as read.
    """

    # Call the service to mark all notifications as read and get the count
    count = await mark_all_as_read_service(user.id)

    # Return the success response with the count of marked notifications
    return SuccessResponse(data={"marked_as_read": count})


# ======================== #
# ===== WebSocket ======== #
# ======================== #

@ws_router.websocket(path="/ws")
async def notifications_ws(
    websocket: WebSocket,
    user: UserORM = Depends(get_ws_user),
) -> None:
    """
    WebSocket endpoint for real-time notification delivery.

    Authentication is performed via the `token` query parameter (standard JWT
    access token) because browsers cannot send custom headers on WebSocket
    connections.

    Once connected, the server pushes a JSON payload for every new notification
    created for the authenticated user. The client does not need to send any
    messages; the connection is kept alive until the client disconnects.

    Connection URL: ws://<host>/api/notifications/ws?token=<access_token>
    """

    # Register the connection and wait for disconnect
    await ws_manager.connect(user.id, websocket)

    try:
        # Keep the connection alive; we only push from server to client
        while True:
            await websocket.receive_text()

    # Handle client disconnect
    except WebSocketDisconnect:
        pass

    finally:
        # Unregister the connection on disconnect
        ws_manager.disconnect(user.id, websocket)