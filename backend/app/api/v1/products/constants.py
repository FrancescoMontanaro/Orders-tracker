from ....db.orm.product import ProductORM

# Define allowed fields for filtering and sorting
ALLOWED_SORTING_FIELDS = {
    "id": ProductORM.id,
    "name": ProductORM.name,
    "unit_price": ProductORM.unit_price,
    "unit": ProductORM.unit,
    "is_active": ProductORM.is_active
}