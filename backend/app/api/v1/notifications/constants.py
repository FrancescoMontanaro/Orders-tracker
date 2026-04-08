from ....db.orm.notification import NotificationORM


# Define allowed fields for filtering and sorting
ALLOWED_NOTIFICATIONS_SORTING_FIELDS = {
    "type": NotificationORM.type,
    "is_read": NotificationORM.is_read,
    "created_at": NotificationORM.created_at
}
