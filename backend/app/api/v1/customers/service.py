from typing import Optional
from sqlalchemy import select, func

from ....db.session import db_session
from ....utils import paginate_filter_sort
from ....db.orm import CustomerORM, OrderORM
from .constants import ALLOWED_SORTING_FIELDS
from ....models import Pagination, ListingQueryParams
from .models import Customer, CustomerCreate, CustomerUpdate


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
        # Call the pagination utility function to list customers
        # By applying pagination, filtering, and sorting if needed
        return await paginate_filter_sort(
            session = session,
            model = CustomerORM,
            pydantic_model = Customer,
            allowed_fields = ALLOWED_SORTING_FIELDS,
            params = params
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
        result = await session.execute(select(CustomerORM).where(CustomerORM.id == customer_id))

        # Get the customer from the result
        customer = result.scalar_one_or_none()

        # Validate and return the customer
        if customer:
            # Map the customer to the Customer model
            return Customer.model_validate(customer)

    # Customer not found
    return None


async def create_customer(customer_create: CustomerCreate) -> Customer:
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

    # Validate and return the created customer
    return Customer.model_validate(customer_orm)


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

        # Map the customer to the Customer model
        return Customer.model_validate(customer)

    # Customer not found
    return None


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