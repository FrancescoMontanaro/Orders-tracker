from ....db.orm.income import IncomeORM
from ....db.orm.income_category import IncomesCategoryORM

# Define allowed fields for filtering and sorting
ALLOWED_INCOMES_SORTING_FIELDS = {
    "id": IncomeORM.id,
    "timestamp": IncomeORM.timestamp,
    "amount": IncomeORM.amount,
    "note": IncomeORM.note,
    "timestamp_after": IncomeORM.timestamp,
    "timestamp_before": IncomeORM.timestamp,
    "min_amount": IncomeORM.amount,
    "max_amount": IncomeORM.amount,
    "category": IncomesCategoryORM.descr,
    "category_id": IncomeORM.category_id
}

ALLOWED_CATEGORIES_SORTING_FIELDS = {
    "id": IncomesCategoryORM.id,
    "descr": IncomesCategoryORM.descr
}