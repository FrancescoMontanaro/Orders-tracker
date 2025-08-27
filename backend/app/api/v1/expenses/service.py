from datetime import date
from typing import Optional, Dict
from sqlalchemy import select, asc, desc, func

from ....db.session import db_session
from ....db.orm.expense import ExpenseORM
from .constants import ALLOWED_SORTING_FIELDS
from ....models import Pagination, ListingQueryParams
from .models import Expense, ExpenseCreate, ExpenseUpdate


async def list_expenses(params: ListingQueryParams) -> Pagination[Expense]:
    """
    List all expenses in the database with pagination, filtering and sorting.

    Args:
    - params (ListingQueryParams): Pagination/filter/sort parameters.

    Returns:
    - Pagination[Expense]: Paginated list of expenses.
    """

    # Compute the pagination parameters
    page = max(1, params.page)
    size = max(1, params.size)
    offset = (page - 1) * size

    # Create the database session
    async with db_session() as session:
        # Create the base statement to fetch expenses
        stmt = select(ExpenseORM)

        # Apply filters
        filters: Dict[str, str] = params.filters or {}

        # Iterate over the filters and apply them to the query
        for field, value in filters.items():
            # Skip None values and unknown fields
            if value is None:
                continue

            # Skip unknown fields
            if field not in ALLOWED_SORTING_FIELDS:
                continue

            # Map the field to the corresponding column
            col = ALLOWED_SORTING_FIELDS[field]

            # Delivery date after
            if field == "timestamp_after":
                try:
                    # Parse the date
                    dvalue = date.fromisoformat(str(value))
                except ValueError:
                    # Force no match
                    stmt = stmt.where(col == date(1900, 1, 1))
                    continue

                # Apply the filter
                stmt = stmt.where(col > dvalue)

            # Delivery date before
            elif field == "timestamp_before":
                try:
                    # Parse the date
                    dvalue = date.fromisoformat(str(value))
                except ValueError:
                    # Force no match
                    stmt = stmt.where(col == date(1900, 1, 1))
                    continue

                # Apply the filter
                stmt = stmt.where(col <= dvalue)
                
            # Amount filters
            elif field == "min_amount":
                stmt = stmt.where(col >= value)
            elif field == "max_amount":
                stmt = stmt.where(col <= value)

            # Other fields
            else:
                # Apply the default text filter (e.g. customer_name)
                stmt = stmt.where(col.ilike(f"%{value}%"))

        # Count the total number of matching orders
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(await session.scalar(count_stmt) or 0)

        # Apply sorting
        if params.sort:
            # Map sorting fields
            order_clauses = []

            # Map sorting fields
            for s in params.sort:
                # Extract sorting field and order
                field = s.field
                order = (s.order or "asc").lower()

                # Map sorting fields
                if field in ALLOWED_SORTING_FIELDS:
                    # Map the field to the corresponding column
                    col = ALLOWED_SORTING_FIELDS[field]

                    # Apply sorting
                    order_clauses.append(desc(col) if order == "desc" else asc(col))

            # Check if there are any order clauses
            if order_clauses:
                # Apply sorting
                stmt = stmt.order_by(*order_clauses)

        # Apply pagination
        stmt = stmt.offset(offset).limit(size)

        # Execute the query
        res = await session.execute(stmt)

        # Get all rows
        expenses_orm = res.scalars().all()

        # Return paginated results
        return Pagination(
            total = total or 0,
            items = [Expense.model_validate(expense_orm, from_attributes=True) for expense_orm in expenses_orm]
        )


async def get_expense_by_id(expense_id: int) -> Optional[Expense]:
    """
    Get an expense by ID.

    Args:
    - expense_id (int): The expense ID.

    Returns:
    - Optional[Expense]: The expense or None if not found.
    """

    # Create a new session
    async with db_session() as session:
        # Execute the query
        res = await session.execute(select(ExpenseORM).where(ExpenseORM.id == expense_id))

        # Get the ORM object
        orm_obj = res.scalar_one_or_none()

        # Validate and return the Pydantic model
        if orm_obj:
            return Expense.model_validate(orm_obj)

    # If not found, return None
    return None


async def create_expense(expense_create: ExpenseCreate) -> Expense:
    """
    Create a new expense.

    Args:
    - expense_create (ExpenseCreate): Payload to create an expense.

    Returns:
    - Expense: The created expense.
    """

    # Create a new session
    async with db_session() as session:
        # Create the ORM object
        obj = ExpenseORM(**expense_create.model_dump())

        # Add the object to the session
        session.add(obj)

        # Commit the transaction
        await session.commit()

        # Refresh the ORM object
        await session.refresh(obj)

        # Validate and return the Pydantic model
        return Expense.model_validate(obj)


async def update_expense(expense_id: int, expense_update: ExpenseUpdate) -> Optional[Expense]:
    """
    Update an existing expense.

    Args:
    - expense_id (int): The expense ID.
    - expense_update (ExpenseUpdate): Fields to update.

    Returns:
    - Optional[Expense]: The updated expense or None if not found.
    """

    # Create a new session
    async with db_session() as session:
        # Get the expense to update
        res = await session.execute(select(ExpenseORM).where(ExpenseORM.id == expense_id))
        obj = res.scalar_one_or_none()
        if not obj:
            return None

        # Update the fields
        data = expense_update.model_dump()
        for field, value in data.items():
            if value is not None:
                setattr(obj, field, value)

        # Commit the transaction
        await session.commit()

        # Refresh the ORM object
        await session.refresh(obj)

        # Validate and return the Pydantic model
        return Expense.model_validate(obj)


async def delete_expense(expense_id: int) -> bool:
    """
    Delete an expense by ID.

    Args:
    - expense_id (int): The expense ID.

    Returns:
    - bool: True if deleted, False otherwise.
    """

    # Create a new session
    async with db_session() as session:
        # Execute the query to get the expense
        res = await session.execute(select(ExpenseORM).where(ExpenseORM.id == expense_id))
        obj = res.scalar_one_or_none()
        if not obj:
            return False

        # Delete the object
        await session.delete(obj)
        await session.commit()

        # Return True if deleted
        return True