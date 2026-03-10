from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from ....db.orm.notification import NotificationTypeEnum


class Notification(BaseModel):
    """
    Representation of a notification returned via API.

    Parameters:
    - id: The unique identifier of the notification.
    - type: The type of notification.
    - title: Short title of the notification.
    - message: Full notification message.
    - is_read: Whether the notification has been read.
    - created_at: When the notification was created.
    - read_at: When the notification was read (null if not yet read).
    - entity_id: Optional reference to the source entity (e.g. export job id).
    """

    id : int
    type : NotificationTypeEnum
    title : str
    message : str
    is_read : bool
    created_at : datetime
    read_at : Optional[datetime] = None
    entity_id : Optional[int] = None

    class Config:
        from_attributes = True
