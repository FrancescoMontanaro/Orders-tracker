from datetime import date
from typing import Optional, Dict, List
from sqlalchemy import select, asc, desc, func

from ....db.session import db_session
from ....models import Pagination, ListingQueryParams
from ....db.orm import ExpenseORM, ExpenseCategoryORM
from .constants import ALLOWED_EXPENSES_SORTING_FIELDS, ALLOWED_CATEGORIES_SORTING_FIELDS
from .models import (
    Expense,
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseCategory,
    ExpenseCategoryCreate,
    ExpenseCategoryUpdate,
)

# ==================== #
# ===== Expenses ===== #
# ==================== #

async def list_expenses(params: ListingQueryParams) -> Pagination[Expense]:
    """
    List all expenses in the database with pagination, filtering and sorting.
    
    Parameters:
    - params: ListingQueryParams - includes page, size, filters, and sort options.
    
    Returns:
    - Pagination[Expense]: Paginated list of expenses.
    """

    # Compute pagination params
    page = max(1, params.page)
    size = params.size
    offset = (page - 1) * size

    async with db_session() as session:
        # Base statement with join to categories to expose the category descr
        stmt = (
            select(
                ExpenseORM,
                ExpenseCategoryORM.descr.label("category"),
            )
            .join(ExpenseCategoryORM, ExpenseCategoryORM.id == ExpenseORM.category_id)
        )

        # Apply filters (keeps your pattern based on ALLOWED_SORTING_FIELDS mapping)
        filters: Dict[str, str] = params.filters or {}
        for field, value in filters.items():
            if value is None:
                continue
            if field not in ALLOWED_EXPENSES_SORTING_FIELDS:
                continue

            col = ALLOWED_EXPENSES_SORTING_FIELDS[field]

            # Timestamp filters
            if field == "timestamp_after":
                try:
                    dvalue = date.fromisoformat(str(value))
                except ValueError:
                    stmt = stmt.where(col == date(1900, 1, 1))
                    continue
                stmt = stmt.where(col >= dvalue)

            elif field == "timestamp_before":
                try:
                    dvalue = date.fromisoformat(str(value))
                except ValueError:
                    stmt = stmt.where(col == date(1900, 1, 1))
                    continue
                stmt = stmt.where(col <= dvalue)

            # Amount filters
            elif field == "min_amount":
                stmt = stmt.where(col >= value)
            elif field == "max_amount":
                stmt = stmt.where(col <= value)

            # Category id filter (exact match)
            elif field == "category_id":
                stmt = stmt.where(col == value)

            # Generic text filters (e.g. note, category descr if mapped)
            else:
                stmt = stmt.where(col.ilike(f"%{value}%"))

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(await session.scalar(count_stmt) or 0)

        # Sorting
        if params.sort:
            order_clauses: List = []
            for s in params.sort:
                field = s.field
                order = (s.order or "asc").lower()
                if field in ALLOWED_EXPENSES_SORTING_FIELDS:
                    col = ALLOWED_EXPENSES_SORTING_FIELDS[field]
                    order_clauses.append(desc(col) if order == "desc" else asc(col))
            if order_clauses:
                stmt = stmt.order_by(*order_clauses)

        # Pagination
        if size > 0: stmt = stmt.offset(offset).limit(size)

        # Execute
        res = await session.execute(stmt)
        rows = res.all()

        # Build response items
        items = [
            Expense.model_validate({
                **expense.__dict__,
                "category": category_descr,   # from label in select
            })
            for expense, category_descr in rows
        ]

        return Pagination(total=total or 0, items=items)


async def get_expense_by_id(expense_id: int) -> Optional[Expense]:
    """
    Get an expense by ID.
    
    Parameters:
    - expense_id: int - ID of the expense to retrieve.
    
    Returns:
    - Optional[Expense]: The expense if found, else None.
    """
    
    # Create a new db session
    async with db_session() as session:
        # Join to also return the category description
        stmt = (
            select(ExpenseORM, ExpenseCategoryORM.descr.label("category"))
            .join(ExpenseCategoryORM, ExpenseCategoryORM.id == ExpenseORM.category_id)
            .where(ExpenseORM.id == expense_id)
        )
        
        # Execute the query
        res = await session.execute(stmt)
        
        # Fetch the first result
        row = res.first()
        
        # If not found, return None
        if not row:
            return None

        # Unpack the result
        expense_orm, category_descr = row
        
        # Return the expense with category description
        return Expense.model_validate({
            **expense_orm.__dict__,
            "category": category_descr,
        })


async def create_expense(expense_create: ExpenseCreate) -> Optional[Expense]:
    """
    Create a new expense.
    
    Parameters:
    - expense_create: ExpenseCreate - data for the new expense.
    
    Returns:
    - Expense: The created expense with category description.
    """
    
    # Create a new db session
    async with db_session() as session:
        # Query the category to ensure it exists
        cat = await session.scalar(
            select(ExpenseCategoryORM).where(ExpenseCategoryORM.id == expense_create.category_id)
        )

        # Ensure category exists
        if not cat:
            # Raise a domain error
            raise ValueError("Category not found")

        # Create and persist the new expense
        obj = ExpenseORM(**expense_create.model_dump())
        
        # Add the object to the session and commit
        session.add(obj)

        # Commit the transaction
        await session.commit()
        await session.refresh(obj)
        
        # Fetch the created expense and return it
        return await get_expense_by_id(obj.id)


async def update_expense(expense_id: int, expense_update: ExpenseUpdate) -> Optional[Expense]:
    """
    Update an existing expense.
    
    Parameters:
    - expense_id: int - ID of the expense to update.
    - expense_update: ExpenseUpdate - fields to update.
    
    Returns:
    - Optional[Expense]: The updated expense if found, else None.
    """
    
    # Create a new db session
    async with db_session() as session:
        # Fetch the existing expense
        res = await session.execute(select(ExpenseORM).where(ExpenseORM.id == expense_id))
        
        # Extract the expense object
        obj = res.scalar_one_or_none()

        # If not found, return None
        if not obj:
            return None

        # Update fields if provided
        data = expense_update.model_dump()
        
        # If category_id is present, validate existence before assignment
        if data.get("category_id") is not None:
            # Validate category exists
            cat = await session.scalar(
                select(ExpenseCategoryORM).where(ExpenseCategoryORM.id == data["category_id"])
            )
            
            # If not found, raise an error
            if not cat:
                # Raise a domain error
                raise ValueError("Category not found")

        # Update fields
        for field, value in data.items():
            if value is not None:
                setattr(obj, field, value)

        # Persist changes
        await session.commit()
        await session.refresh(obj)

        # Return the updated expense with category description
        return await get_expense_by_id(obj.id)


async def delete_expense(expense_id: int) -> bool:
    """
    Delete an expense by ID.
    
    Parameters:
    - expense_id: int - ID of the expense to delete.
    
    Returns:
    - bool: True if deleted, False if not found.
    """
    
    # Create a new db session
    async with db_session() as session:
        # Fetch the existing expense
        res = await session.execute(select(ExpenseORM).where(ExpenseORM.id == expense_id))
        
        # Extract the expense object
        obj = res.scalar_one_or_none()
        if not obj:
            return False

        # Delete the object
        await session.delete(obj)
        
        # Commit the transaction
        await session.commit()

        # Return success
        return True
    

# =============================== #
# ===== Expenses categories ===== #
# =============================== #

async def list_expense_categories(params: ListingQueryParams) -> Pagination[ExpenseCategory]:
    """
    List expense categories with pagination, filtering by text, and sorting.
    
    Parameters:
    - params: ListingQueryParams - includes page, size, filters, and sort options.
    
    Returns:
    - Pagination[ExpenseCategory]: Paginated list of expense categories.
    """

    # Compute pagination params
    page = max(1, params.page)
    size = params.size
    offset = (page - 1) * size

    # Create a new db session
    async with db_session() as session:
        # Base statement
        stmt = select(ExpenseCategoryORM)

        # Simple filter support: descr ilike (keeps consistency with your pattern)
        filters: Dict[str, str] = params.filters or {}
        for field, value in filters.items():
            if value is None:
                continue
            if field not in ALLOWED_CATEGORIES_SORTING_FIELDS:
                continue

            # Get the column
            col = ALLOWED_CATEGORIES_SORTING_FIELDS[field]
            
            # Generic text filters (e.g. descr)
            stmt = stmt.where(col.ilike(f"%{value}%"))

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(await session.scalar(count_stmt) or 0)

        # Sorting
        if params.sort:
            order_clauses: List = []
            for s in params.sort:
                field = s.field
                order = (s.order or "asc").lower()
                if field in ALLOWED_CATEGORIES_SORTING_FIELDS:
                    col = ALLOWED_CATEGORIES_SORTING_FIELDS[field]
                    order_clauses.append(desc(col) if order == "desc" else asc(col))
            if order_clauses:
                stmt = stmt.order_by(*order_clauses)

        # Pagination if size is set
        if size > 0: stmt = stmt.offset(offset).limit(size)

        # Execute the query
        res = await session.execute(stmt)

        # Fetch all results
        all_results = res.scalars().all()

        # Build the response items
        rows = [ExpenseCategory.model_validate(x) for x in all_results]

        # Return the pagination response
        return Pagination(total=total or 0, items=rows)


async def get_expense_category_by_id(category_id: int) -> Optional[ExpenseCategory]:
    """
    Get an expense category by ID.
    
    Parameters:
    - category_id: int - ID of the category to retrieve.
    
    Returns:
    - Optional[ExpenseCategory]: The category if found, else None.
    """
    
    # Create a new db session
    async with db_session() as session:
        # Execute the query
        res = await session.execute(
            select(ExpenseCategoryORM).where(ExpenseCategoryORM.id == category_id)
        )
        
        # Extract the category object
        obj = res.scalar_one_or_none()
        
        # If not found, return None
        if not obj:
            return None
        
        # Return the category
        return ExpenseCategory.model_validate(obj)


async def create_expense_category(payload: ExpenseCategoryCreate) -> Optional[ExpenseCategory]:
    """
    Create a new expense category.
    
    Parameters:
    - payload: ExpenseCategoryCreate - data for the new category.
    
    Returns:
    - ExpenseCategory: The created category.
    """
    
    # Create a new database session
    async with db_session() as session:
        # Create the ORM object
        obj = ExpenseCategoryORM(**payload.model_dump())

        # Add the ORM object to the session
        session.add(obj)

        # Commit the transaction
        await session.commit()

        # Refresh the ORM object
        await session.refresh(obj)

        # Return the created category
        return await get_expense_category_by_id(obj.id)


async def update_expense_category(category_id: int, payload: ExpenseCategoryUpdate) -> Optional[ExpenseCategory]:
    """
    Update an existing expense category.
    
    Parameters:
    - category_id: int - ID of the category to update.
    - payload: ExpenseCategoryUpdate - fields to update.
    
    Returns:
    - Optional[ExpenseCategory]: The updated category if found, else None.
    """
    
    # Create a new database session
    async with db_session() as session:
        # Execute the query to retrieve the category
        res = await session.execute(select(ExpenseCategoryORM).where(ExpenseCategoryORM.id == category_id))

        # Get the ORM object
        obj = res.scalar_one_or_none()

        # Check if the category exists
        if not obj:
            return None

        # Update the ORM object
        data = payload.model_dump()

        # Update the fields
        for field, value in data.items():
            # Skip None values
            if value is not None:
                # Set the attribute
                setattr(obj, field, value)

        # Commit the transaction
        await session.commit()

        # Refresh the ORM object
        await session.refresh(obj)
        
        # Fetch and return the updated category
        return await get_expense_category_by_id(category_id)


async def delete_expense_category(category_id: int) -> bool:
    """
    Delete an expense category by ID.
    
    Parameters:
    - category_id: int - ID of the category to delete.
    
    Returns:
    - bool: True if deleted, False if not found or if category has associated expenses.
    """
    
    # Get the database session
    async with db_session() as session:
        # Use the session to query the database for the category
        result = await session.execute(select(ExpenseCategoryORM).where(ExpenseCategoryORM.id == category_id))

        # Get the category from the result
        category = result.scalar_one_or_none()

        # If the category exists, delete it
        if category:
            # Delete the category
            await session.delete(category)

            # Commit the transaction
            await session.commit()

            # Category successfully deleted
            return True

    # Category not found
    return False


async def category_has_expenses(category_id: int) -> bool:
    """
    Return True if the category is referenced by at least one expense.

    Parameters:
    - category_id (int): The ID of the category to check.

    Returns:
    - bool: True if the category has expenses, False otherwise.
    """

    # Create the database session
    async with db_session() as session:
        # Count the number of expenses for the category
        count = await session.scalar(
            select(func.count())
            .select_from(ExpenseORM)
            .where(ExpenseORM.category_id == category_id)
        )

        # Check if the count is greater than 0
        return (count or 0) > 0