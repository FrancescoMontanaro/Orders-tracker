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


# Sheet / CSV filename for each entity type (used in XLSX tabs and ZIP archive entries).
# Must be ≤ 31 characters (Excel limit for sheet names).
ENTITY_SHEET_NAMES: dict[ExportEntityEnum, str] = {
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
    ExportEntityEnum.CUSTOMERS: ["ID", "Nome", "Attivo"],
    ExportEntityEnum.PRODUCTS: ["ID", "Nome", "Prezzo unitario", "Unità di misura", "Attivo"],
    ExportEntityEnum.ORDERS: ["ID", "Cliente", "Data consegna", "Data creazione", "Sconto applicato (%)", "Stato", "Note"],
    ExportEntityEnum.ORDER_ITEMS: ["ID", "ID ordine", "Prodotto", "Quantità", "Prezzo unitario", "ID lotto"],
    ExportEntityEnum.EXPENSES: ["ID", "Categoria", "Data", "Importo", "Note"],
    ExportEntityEnum.INCOMES: ["ID", "Categoria", "Data", "Importo", "Note"],
    ExportEntityEnum.LOTS: ["ID", "Nome", "Data lotto", "Posizione", "Descrizione"],
    ExportEntityEnum.NOTES: ["ID", "Testo", "Data creazione", "Ultima modifica"]
}