from typing import Optional
from sqlalchemy import select, func

from ....db.session import db_session
from ....utils import paginate_filter_sort
from .constants import ALLOWED_SORTING_FIELDS
from ....db.orm import ProductORM, OrderItemORM
from ....models import Pagination, ListingQueryParams
from .models import Product, ProductCreate, ProductUpdate


async def list_products(params: ListingQueryParams) -> Pagination[Product]:
    """
    List products with pagination, filtering and sorting.

    Parameters:
    - params (ListingQueryParams): The query parameters for listing products.

    Returns:
    - Pagination[Product]: A paginated list of products.
    """

    # Create a new database session
    async with db_session() as session:
        # Execute the query and return the paginated result
        return await paginate_filter_sort(
            session = session,
            model = ProductORM,
            pydantic_model = Product,
            allowed_fields = ALLOWED_SORTING_FIELDS,
            params = params
        )


async def get_product_by_id(product_id: int) -> Optional[Product]:
    """
    Get a product by ID.

    Parameters:
    - product_id (int): The ID of the product to retrieve.

    Returns:
    - Optional[Product]: The retrieved product or None if not found.
    """

    # Create a new database session
    async with db_session() as session:
        # Execute the query to retrieve the product
        res = await session.execute(select(ProductORM).where(ProductORM.id == product_id))

        # Get the ORM object
        orm_obj = res.scalar_one_or_none()

        # Validate and return the product
        if orm_obj:
            # Validate the ORM object
            return Product.model_validate(orm_obj)

    # If the product was not found, return None
    return None


async def create_product(product_create: ProductCreate) -> Optional[Product]:
    """
    Create a new product.

    Parameters:
    - product_create (ProductCreate): The product data to create.

    Returns:
    - Product: The created product.
    """

    # Create a new database session
    async with db_session() as session:
        # Create the ORM object
        obj = ProductORM(**product_create.model_dump())

        # Add the ORM object to the session
        session.add(obj)

        # Commit the transaction
        await session.commit()

        # Refresh the ORM object
        await session.refresh(obj)

    # Return the created product
    return await get_product_by_id(obj.id)


async def update_product(product_id: int, product_update: ProductUpdate) -> Optional[Product]:
    """
    Update an existing product.

    Parameters:
    - product_id (int): The ID of the product to update.
    - product_update (ProductUpdate): The updated product data.

    Returns:
    - Optional[Product]: The updated product or None if not found.
    """

    # Create a new database session
    async with db_session() as session:
        # Execute the query to retrieve the product
        res = await session.execute(select(ProductORM).where(ProductORM.id == product_id))

        # Get the ORM object
        obj = res.scalar_one_or_none()

        # Check if the product exists
        if not obj:
            return None

        # Update the ORM object
        data = product_update.model_dump()

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

    # Return the updated product
    return await get_product_by_id(product_id)


async def delete_product(product_id: int) -> bool:
    """
    Delete a product by ID.

    Parameters:
    - product_id (int): The ID of the product to delete.

    Returns:
    - bool: True if the product was deleted, False otherwise.
    """

    # Create a new database session
    async with db_session() as session:
        # Execute the query to retrieve the product
        res = await session.execute(select(ProductORM).where(ProductORM.id == product_id))

        # Get the ORM object
        obj = res.scalar_one_or_none()

        # Check if the product exists
        if not obj:
            return False

        # Delete the ORM object
        await session.delete(obj)

        # Commit the transaction
        await session.commit()

        # Return True if the product was deleted
        return True
    
    
async def product_has_orders(product_id: int) -> bool:
    """
    Return True if the product is referenced by at least one order item.

    Parameters:
    - product_id (int): The ID of the product to check.

    Returns:
    - bool: True if the product has orders, False otherwise.
    """

    # Create the database session
    async with db_session() as session:
        # Count the number of order items for the product
        count = await session.scalar(
            select(func.count())
            .select_from(OrderItemORM)
            .where(OrderItemORM.product_id == product_id)
        )

        # Check if the count is greater than 0
        return (count or 0) > 0