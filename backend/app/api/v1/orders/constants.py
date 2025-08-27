from ....db.orm.order import OrderORM
from ....db.orm.customer import CustomerORM 

# Allowed fields for filtering/sorting on orders list
ALLOWED_SORTING_FIELDS = {
    "id": OrderORM.id,
    "delivery_date": OrderORM.delivery_date,
    "customer_id": OrderORM.customer_id,
    "created_at": OrderORM.created_at,
    "customer_name": CustomerORM.name,
    "delivery_date_after": OrderORM.delivery_date,
    "delivery_date_before": OrderORM.delivery_date,
    "status": OrderORM.status
}