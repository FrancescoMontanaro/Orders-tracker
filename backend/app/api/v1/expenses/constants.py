from ....db.orm.expense import ExpenseORM
from ....db.orm.expense_category import ExpenseCategoryORM

# Define allowed fields for filtering and sorting
ALLOWED_EXPENSES_SORTING_FIELDS = {
    "id": ExpenseORM.id,
    "timestamp": ExpenseORM.timestamp,
    "amount": ExpenseORM.amount,
    "note": ExpenseORM.note,
    "timestamp_after": ExpenseORM.timestamp,
    "timestamp_before": ExpenseORM.timestamp,
    "min_amount": ExpenseORM.amount,
    "max_amount": ExpenseORM.amount,
    "category": ExpenseCategoryORM.descr,
    "category_id": ExpenseORM.category_id
}

ALLOWED_CATEGORIES_SORTING_FIELDS = {
    "id": ExpenseCategoryORM.id,
    "descr": ExpenseCategoryORM.descr
}