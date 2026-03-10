from ....db.orm.export_job import ExportJobORM, ExportEntityEnum


# Define allowed fields for filtering and sorting
ALLOWED_EXPORT_JOBS_SORTING_FIELDS = {
    "status": ExportJobORM.status,
    "entity_type": ExportJobORM.entity_type,
    "format": ExportJobORM.format,
    "created_at":  ExportJobORM.created_at
}


# Column headers exported for each entity type
ENTITY_HEADERS: dict[ExportEntityEnum, list[str]] = {
    ExportEntityEnum.CUSTOMERS: ["id", "name", "is_active"],
    ExportEntityEnum.PRODUCTS: ["id", "name", "unit_price", "unit", "is_active"],
    ExportEntityEnum.ORDERS: ["id", "customer_name", "delivery_date", "created_at", "applied_discount", "status", "note"],
    ExportEntityEnum.EXPENSES: ["id", "category", "timestamp", "amount", "note"],
    ExportEntityEnum.INCOMES: ["id", "category", "timestamp", "amount", "note"],
    ExportEntityEnum.LOTS: ["id", "name", "lot_date", "location", "description"],
    ExportEntityEnum.NOTES: ["id", "text", "created_at", "updated_at"]
}