from datetime import date
from typing import Optional, Dict, List
from sqlalchemy import select, asc, desc, func

from ....db.session import db_session
from ....models import Pagination, ListingQueryParams
from ....db.orm import IncomeORM, IncomesCategoryORM
from .constants import ALLOWED_INCOMES_SORTING_FIELDS, ALLOWED_CATEGORIES_SORTING_FIELDS
from .models import (
    Income,
    IncomeCreate,
    IncomeUpdate,
    IncomeCategory,
    IncomeCategoryCreate,
    IncomeCategoryUpdate,
    PaginationIncome
)

# =================== #
# ===== Incomes ===== #
# =================== #

async def list_incomes(params: ListingQueryParams) -> PaginationIncome[Income]:
    """
    List all incomes in the database with pagination, filtering and sorting.

    Parameters:
    - params: ListingQueryParams - includes page, size, filters, and sort options.
    
    Returns:
    - PaginationIncome[Income]: Paginated list of incomes.
    """

    # Compute pagination params
    page = max(1, params.page)
    size = params.size
    offset = (page - 1) * size

    async with db_session() as session:
        # --- Costruisco condizioni di filtro una sola volta ---
        filters: Dict[str, str] = params.filters or {}
        conditions = []

        def parse_date_safe(val: str) -> date | None:
            try:
                return date.fromisoformat(str(val))
            except Exception:
                return None

        for field, value in filters.items():
            if value is None:
                continue
            if field not in ALLOWED_INCOMES_SORTING_FIELDS:
                continue

            col = ALLOWED_INCOMES_SORTING_FIELDS[field]

            if field == "timestamp_after":
                dvalue = parse_date_safe(value)
                conditions.append(col >= dvalue if dvalue else (col == date(1900, 1, 1)))
            elif field == "timestamp_before":
                dvalue = parse_date_safe(value)
                conditions.append(col <= dvalue if dvalue else (col == date(1900, 1, 1)))
            elif field == "min_amount":
                conditions.append(col >= value)
            elif field == "max_amount":
                conditions.append(col <= value)
            elif field == "category_id":
                conditions.append(col == value)
            else:
                conditions.append(col.ilike(f"%{value}%"))

        # --- Subquery filtrata SOLO con IncomeORM per COUNT e SUM ---
        filtered_base = (
            select(IncomeORM)
            .join(IncomesCategoryORM, IncomesCategoryORM.id == IncomeORM.category_id)
            .where(*conditions) if conditions else
            select(IncomeORM).join(IncomesCategoryORM, IncomesCategoryORM.id == IncomeORM.category_id)
        )
        filtered_sq = filtered_base.subquery()

        # COUNT totale elementi filtrati
        total = int(await session.scalar(select(func.count()).select_from(filtered_sq)) or 0)

        # SUM importi filtrati (indipendente da paginazione)
        total_amount = float(
            await session.scalar(
                select(func.coalesce(func.sum(filtered_sq.c.amount), 0.0))
            ) or 0.0
        )

        # --- Query per le righe (con categoria visibile) ---
        rows_stmt = (
            select(
                IncomeORM,
                IncomesCategoryORM.descr.label("category"),
            )
            .join(IncomesCategoryORM, IncomesCategoryORM.id == IncomeORM.category_id)
        )
        if conditions:
            rows_stmt = rows_stmt.where(*conditions)

        # Ordinamento
        if params.sort:
            order_clauses: List = []
            for s in params.sort:
                field = s.field
                order = (s.order or "asc").lower()
                if field in ALLOWED_INCOMES_SORTING_FIELDS:
                    col = ALLOWED_INCOMES_SORTING_FIELDS[field]
                    order_clauses.append(desc(col) if order == "desc" else asc(col))
            if order_clauses:
                rows_stmt = rows_stmt.order_by(*order_clauses)

        # Paginazione
        if size > 0:
            rows_stmt = rows_stmt.offset(offset).limit(size)

        # Esecuzione
        res = await session.execute(rows_stmt)
        rows = res.all()

        items = [
            Income.model_validate({
                **income.__dict__,
                "category": category_descr,
            })
            for income, category_descr in rows
        ]

        return PaginationIncome(total=total, items=items, total_amount=total_amount)


async def get_income_by_id(income_id: int) -> Optional[Income]:
    """
    Get an income by ID.

    Parameters:
    - income_id: int - ID of the income to retrieve.
    
    Returns:
    - Optional[Income]: The income if found, else None.
    """
    
    # Create a new db session
    async with db_session() as session:
        # Join to also return the category description
        stmt = (
            select(IncomeORM, IncomesCategoryORM.descr.label("category"))
            .join(IncomesCategoryORM, IncomesCategoryORM.id == IncomeORM.category_id)
            .where(IncomeORM.id == income_id)
        )
        
        # Execute the query
        res = await session.execute(stmt)
        
        # Fetch the first result
        row = res.first()
        
        # If not found, return None
        if not row:
            return None

        # Unpack the result
        income_orm, category_descr = row

        # Return the income with category description
        return Income.model_validate({
            **income_orm.__dict__,
            "category": category_descr,
        })


async def create_income(income_create: IncomeCreate) -> Optional[Income]:
    """
    Create a new income.

    Parameters:
    - income_create: IncomeCreate - data for the new income.

    Returns:
    - Optional[Income]: The created income if successful, else None.
    """
    
    # Create a new db session
    async with db_session() as session:
        # Query the category to ensure it exists
        cat = await session.scalar(
            select(IncomesCategoryORM).where(IncomesCategoryORM.id == income_create.category_id)
        )

        # Ensure category exists
        if not cat:
            # Raise a domain error
            raise ValueError("Category not found")

        # Create and persist the new income
        obj = IncomeORM(**income_create.model_dump())

        # Add the object to the session and commit
        session.add(obj)

        # Commit the transaction
        await session.commit()
        await session.refresh(obj)

        # Fetch the created income and return it
        return await get_income_by_id(obj.id)


async def update_income(income_id: int, income_update: IncomeUpdate) -> Optional[Income]:
    """
    Update an existing income.

    Parameters:
    - income_id: int - ID of the income to update.
    - income_update: IncomeUpdate - fields to update.

    Returns:
    - Optional[Income]: The updated income if found, else None.
    """
    
    # Create a new db session
    async with db_session() as session:
        # Fetch the existing income
        res = await session.execute(select(IncomeORM).where(IncomeORM.id == income_id))

        # Extract the income object
        obj = res.scalar_one_or_none()

        # If not found, return None
        if not obj:
            return None

        # Update fields if provided
        data = income_update.model_dump()
        
        # If category_id is present, validate existence before assignment
        if data.get("category_id") is not None:
            # Validate category exists
            cat = await session.scalar(
                select(IncomesCategoryORM).where(IncomesCategoryORM.id == data["category_id"])
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

        # Return the updated income with category description
        return await get_income_by_id(obj.id)


async def delete_income(income_id: int) -> bool:
    """
    Delete an income by ID.

    Parameters:
    - income_id: int - ID of the income to delete.
    
    Returns:
    - bool: True if deleted, False if not found.
    """
    
    # Create a new db session
    async with db_session() as session:
        # Fetch the existing income
        res = await session.execute(select(IncomeORM).where(IncomeORM.id == income_id))

        # Extract the income object
        obj = res.scalar_one_or_none()
        if not obj:
            return False

        # Delete the object
        await session.delete(obj)
        
        # Commit the transaction
        await session.commit()

        # Return success
        return True
    

# ============================== #
# ===== Incomes categories ===== #
# ============================== #

async def list_income_categories(params: ListingQueryParams) -> Pagination[IncomeCategory]:
    """
    List income categories with pagination, filtering by text, and sorting.

    Parameters:
    - params: ListingQueryParams - includes page, size, filters, and sort options.
    
    Returns:
    - Pagination[IncomeCategory]: Paginated list of income categories.
    """

    # Compute pagination params
    page = max(1, params.page)
    size = params.size
    offset = (page - 1) * size

    # Create a new db session
    async with db_session() as session:
        # Base statement
        stmt = select(IncomesCategoryORM)

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
        rows = [IncomeCategory.model_validate(x) for x in all_results]

        # Return the pagination response
        return Pagination(total=total or 0, items=rows)


async def get_income_category_by_id(category_id: int) -> Optional[IncomeCategory]:
    """
    Get an income category by ID.

    Parameters:
    - category_id: int - ID of the category to retrieve.
    
    Returns:
    - Optional[IncomeCategory]: The category if found, else None.
    """
    
    # Create a new db session
    async with db_session() as session:
        # Execute the query
        res = await session.execute(
            select(IncomesCategoryORM).where(IncomesCategoryORM.id == category_id)
        )
        
        # Extract the category object
        obj = res.scalar_one_or_none()
        
        # If not found, return None
        if not obj:
            return None
        
        # Return the category
        return IncomeCategory.model_validate(obj)


async def create_income_category(payload: IncomeCategoryCreate) -> Optional[IncomeCategory]:
    """
    Create a new income category.
    
    Parameters:
    - payload: IncomeCategoryCreate - data for the new category.

    Returns:
    - IncomeCategory: The created category.
    """
    
    # Create a new database session
    async with db_session() as session:
        # Create the ORM object
        obj = IncomesCategoryORM(**payload.model_dump())

        # Add the ORM object to the session
        session.add(obj)

        # Commit the transaction
        await session.commit()

        # Refresh the ORM object
        await session.refresh(obj)

        # Return the created category
        return await get_income_category_by_id(obj.id)


async def update_income_category(category_id: int, payload: IncomeCategoryUpdate) -> Optional[IncomeCategory]:
    """
    Update an existing income category.
    
    Parameters:
    - category_id: int - ID of the category to update.
    - payload: IncomeCategoryUpdate - fields to update.

    Returns:
    - Optional[IncomeCategory]: The updated category if found, else None.
    """
    
    # Create a new database session
    async with db_session() as session:
        # Execute the query to retrieve the category
        res = await session.execute(select(IncomesCategoryORM).where(IncomesCategoryORM.id == category_id))

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
        return await get_income_category_by_id(category_id)


async def delete_income_category(category_id: int) -> bool:
    """
    Delete an income category by ID.
    
    Parameters:
    - category_id: int - ID of the category to delete.
    
    Returns:
    - bool: True if deleted, False if not found or if category has associated incomes.
    """
    
    # Get the database session
    async with db_session() as session:
        # Use the session to query the database for the category
        result = await session.execute(select(IncomesCategoryORM).where(IncomesCategoryORM.id == category_id))

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


async def category_has_incomes(category_id: int) -> bool:
    """
    Return True if the category is referenced by at least one income.

    Parameters:
    - category_id (int): The ID of the category to check.

    Returns:
    - bool: True if the category has incomes, False otherwise.
    """

    # Create the database session
    async with db_session() as session:
        # Count the number of incomes for the category
        count = await session.scalar(
            select(func.count())
            .select_from(IncomeORM)
            .where(IncomeORM.category_id == category_id)
        )

        # Check if the count is greater than 0
        return (count or 0) > 0