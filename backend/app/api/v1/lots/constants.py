from ....db.orm.lot import LotORM

# Allowed fields for filtering/sorting on lots list
ALLOWED_LOTS_SORTING_FIELDS = {
    "id": LotORM.id,
    "name": LotORM.name,
    "lot_date": LotORM.lot_date,
    "description": LotORM.description,
    "lot_date_after": LotORM.lot_date,
    "lot_date_before": LotORM.lot_date,
}
