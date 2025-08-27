from ....db.orm.expense import ExpenseORM

# Define allowed fields for filtering and sorting
ALLOWED_SORTING_FIELDS = {
    "id": ExpenseORM.id,
    "timestamp": ExpenseORM.timestamp,
    "amount": ExpenseORM.amount,
    "note": ExpenseORM.note,
    "timestamp_after": ExpenseORM.timestamp,
    "timestamp_before": ExpenseORM.timestamp,
    "min_amount": ExpenseORM.amount,
    "max_amount": ExpenseORM.amount
}