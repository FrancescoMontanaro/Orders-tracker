from ....db.orm.export_job import ExportJobORM, ExportEntityEnum


# Define allowed fields for filtering and sorting
ALLOWED_EXPORT_JOBS_SORTING_FIELDS = {
    "status": ExportJobORM.status,
    "entity_type": ExportJobORM.entity_type,
    "format": ExportJobORM.format,
    "created_at":  ExportJobORM.created_at
}


# Human-readable label for each entity type (used in notifications)
ENTITY_LABELS: dict[ExportEntityEnum, str] = {
    ExportEntityEnum.ALL: "Tutti i dati",
    ExportEntityEnum.CUSTOMERS: "Clienti",
    ExportEntityEnum.PRODUCTS: "Prodotti",
    ExportEntityEnum.ORDERS: "Ordini",
    ExportEntityEnum.ORDER_ITEMS: "Righe ordine",
    ExportEntityEnum.EXPENSES: "Spese",
    ExportEntityEnum.INCOMES: "Entrate",
    ExportEntityEnum.LOTS: "Lotti",
    ExportEntityEnum.NOTES: "Note"
}


# Column headers exported for each entity type
ENTITY_HEADERS: dict[ExportEntityEnum, list[str]] = {
    ExportEntityEnum.CUSTOMERS: ["id", "name", "is_active"],
    ExportEntityEnum.PRODUCTS: ["id", "name", "unit_price", "unit", "is_active"],
    ExportEntityEnum.ORDERS: ["id", "customer_name", "delivery_date", "created_at", "applied_discount", "status", "note"],
    ExportEntityEnum.ORDER_ITEMS: ["id", "order_id", "product_name", "quantity", "unit_price", "lot_id"],
    ExportEntityEnum.EXPENSES: ["id", "category", "timestamp", "amount", "note"],
    ExportEntityEnum.INCOMES: ["id", "category", "timestamp", "amount", "note"],
    ExportEntityEnum.LOTS: ["id", "name", "lot_date", "location", "description"],
    ExportEntityEnum.NOTES: ["id", "text", "created_at", "updated_at"]
}