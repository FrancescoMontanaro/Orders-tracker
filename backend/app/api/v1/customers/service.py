from typing import Optional
from sqlalchemy import select, func, asc, desc
from sqlalchemy.orm import selectinload

from ....db.session import db_session
from ....db.orm import CustomerORM, CustomerPreferencesORM, OrderORM
from .constants import ALLOWED_SORTING_FIELDS
from ....models import Pagination, ListingQueryParams
from .models import Customer, CustomerCreate, CustomerUpdate, CustomerPreferences, CustomerPreferencesUpdate


async def list_customers(params: ListingQueryParams) -> Pagination[Customer]:
    """
    List all customers in the database.

    Args:
        page (int): The page number to retrieve.
        size (int): The number of items per page.

    Returns:
        Pagination: The paginated response containing customer data.
    """

    # Create a database session
    async with db_session() as session:
        # Get pagination parameters
        page = max(1, params.page)
        size = params.size
        offset = (page - 1) * size

        # Initialize query with eager-loaded preferences
        stmt = select(CustomerORM).options(selectinload(CustomerORM.preferences))

        # Apply filters
        if params.filters:
            # Iterate over filter fields
            for field, value in params.filters.items():
                # Skip invalid fields
                if field in ALLOWED_SORTING_FIELDS and value is not None:
                    # Apply filter
                    if isinstance(value, str):
                        # Use ilike for string fields
                        stmt = stmt.where(ALLOWED_SORTING_FIELDS[field].ilike(f"%{value}%"))
                    elif isinstance(value, (int, float, bool)):
                        # Use equality for numeric and boolean fields
                        stmt = stmt.where(ALLOWED_SORTING_FIELDS[field] == value)

        # Count total (with filters applied)
        count_stmt = select(func.count()).select_from(stmt.subquery())

        # Apply sorting
        if params.sort:
            # Build order clauses based on allowed fields
            order_clauses = []

            # Iterate over sort fields
            for s in params.sort:
                # Skip invalid fields
                if s.field in ALLOWED_SORTING_FIELDS:
                    # Get the column
                    col = ALLOWED_SORTING_FIELDS[s.field]

                    # Apply sorting direction
                    if s.order == "desc":
                        order_clauses.append(desc(col))
                    else:
                        order_clauses.append(asc(col))

            # If there are order clauses, apply sorting
            if order_clauses:
                stmt = stmt.order_by(*order_clauses)

        # Apply pagination
        if size > 0:
            stmt = stmt.offset(offset).limit(size)

        # Execute count and data queries
        total = await session.scalar(count_stmt)
        result = await session.execute(stmt)
        rows = result.scalars().all()

        # Return paginated response
        return Pagination(
            total = total or 0,
            items = [Customer.model_validate(row, from_attributes=True) for row in rows]
        )


async def get_customer_by_id(customer_id: int) -> Optional[Customer]:
    """
    Get a customer by ID.

    Args:
        customer_id (int): The ID of the customer to retrieve.

    Returns:
        Optional[Customer]: The retrieved customer or None if not found.
    """

    # Get the database session
    async with db_session() as session:
        # Use the session to query the database for the customer
        result = await session.execute(
            select(CustomerORM)
            .options(selectinload(CustomerORM.preferences))
            .where(CustomerORM.id == customer_id)
        )

        # Get the customer from the result
        customer = result.scalar_one_or_none()

        # Validate and return the customer
        if customer:
            # Map the customer to the Customer model
            return Customer.model_validate(customer, from_attributes=True)

    # Customer not found
    return None


async def create_customer(customer_create: CustomerCreate) -> Optional[Customer]:
    """
    Create a new customer in the database.

    Args:
        customer_create (CustomerCreate): The customer data to create.

    Returns:
        Customer: The created customer.
    """

    # Get the database session
    async with db_session() as session:
        # Create a new CustomerORM instance
        customer_orm = CustomerORM(**customer_create.model_dump())

        # Add the new customer to the session
        session.add(customer_orm)

        # Commit the transaction
        await session.commit()

        # Refresh the instance to get the new ID
        await session.refresh(customer_orm)

        # Create default preferences for the new customer
        preferences_orm = CustomerPreferencesORM(
            customer_id = customer_orm.id,
            ddt_include_quantity = True
        )

        # Add preferences to the session and commit
        session.add(preferences_orm)
        await session.commit()

    # Validate and return the created customer (re-fetches with eager loading)
    return await get_customer_by_id(customer_orm.id)


async def update_customer(customer_id: int, customer_update: CustomerUpdate) -> Optional[Customer]:
    """
    Update an existing customer in the database.

    Args:
        customer_id (int): The ID of the customer to update.
        customer_update (CustomerUpdate): The updated customer data.

    Returns:
        Optional[Customer]: The updated customer or None if not found.
    """

    # Get the database session
    async with db_session() as session:
        # Use the session to query the database for the customer
        result = await session.execute(select(CustomerORM).where(CustomerORM.id == customer_id))

        # Get the customer from the result
        customer = result.scalar_one_or_none()

        # Check if the customer was found
        if not customer:
            return None

        # Get the updated data
        data = customer_update.model_dump()

        # Update the fields
        for field, value in data.items():
            # Skip None values
            if value is not None:
                # Set the attribute
                setattr(customer, field, value)

        # Validate and return the customer
        await session.commit()

        # Refresh the instance to get the updated data
        await session.refresh(customer)

    return await get_customer_by_id(customer_id)


async def delete_customer(customer_id: int) -> bool:
    """
    Delete a customer by ID.

    Args:
        customer_id (int): The ID of the customer to delete.

    Returns:
        bool: True if the customer was deleted, False otherwise.
    """

    # Get the database session
    async with db_session() as session:
        # Use the session to query the database for the customer
        result = await session.execute(select(CustomerORM).where(CustomerORM.id == customer_id))

        # Get the customer from the result
        customer = result.scalar_one_or_none()

        # If the customer exists, delete it
        if customer:
            # Delete the customer
            await session.delete(customer)

            # Commit the transaction
            await session.commit()

            # Customer successfully deleted
            return True

    # Customer not found
    return False


async def customer_has_orders(customer_id: int) -> bool:
    """
    Return True if the customer is referenced by at least one order item.

    Parameters:
    - customer_id (int): The ID of the customer to check.

    Returns:
    - bool: True if the product has orders, False otherwise.
    """

    # Create the database session
    async with db_session() as session:
        # Count the number of order items for the product
        count = await session.scalar(
            select(func.count())
            .select_from(OrderORM)
            .where(OrderORM.customer_id == customer_id)
        )

        # Check if the count is greater than 0
        return (count or 0) > 0


async def update_customer_preferences(customer_id: int, preferences_update: CustomerPreferencesUpdate) -> Optional[CustomerPreferences]:
    """
    Update the preferences of an existing customer.

    Args:
        customer_id (int): The ID of the customer whose preferences to update.
        preferences_update (CustomerPreferencesUpdate): The updated preferences data.

    Returns:
        Optional[CustomerPreferences]: The updated preferences or None if customer not found.
    """

    # Get the database session
    async with db_session() as session:
        # Check if the customer exists
        customer_result = await session.execute(select(CustomerORM).where(CustomerORM.id == customer_id))

        # Return None if customer not found
        if not customer_result.scalar_one_or_none():
            return None

        # Fetch existing preferences for the customer
        prefs_result = await session.execute(
            select(CustomerPreferencesORM).where(CustomerPreferencesORM.customer_id == customer_id)
        )
        prefs_orm = prefs_result.scalar_one_or_none()

        # Upsert: create if not found, otherwise update in place
        if prefs_orm is None:
            # Create default preferences and apply any provided fields
            prefs_orm = CustomerPreferencesORM(
                customer_id = customer_id,
                ddt_include_quantity = True
            )
            session.add(prefs_orm)

        # Apply non-None fields from the update payload
        for field, value in preferences_update.model_dump().items():
            if value is not None:
                setattr(prefs_orm, field, value)

        # Commit and refresh to get persisted state
        await session.commit()
        await session.refresh(prefs_orm)

        # Map and return the updated preferences
        return CustomerPreferences.model_validate(prefs_orm, from_attributes=True)