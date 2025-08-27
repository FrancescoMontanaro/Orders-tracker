from ....db.orm.customer import CustomerORM

# Define allowed fields for filtering and sorting
ALLOWED_SORTING_FIELDS = {
    "id": CustomerORM.id,
    "name": CustomerORM.name,
    "is_active": CustomerORM.is_active
}