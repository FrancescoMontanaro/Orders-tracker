from sqlalchemy.exc import IntegrityError
from typing import Optional, Dict, List, Any
from fastapi import APIRouter, status, HTTPException

from ....core.response_models import SuccessResponse
from .models import Product, ProductCreate, ProductUpdate
from ....models import Pagination, SortParam, ListingQueryParams

# Import service functions
from .service import (
    list_products as list_products_service,
    get_product_by_id as get_product_by_id_service,
    create_product as create_product_service,
    update_product as update_product_service,
    delete_product as delete_product_service,
    product_has_orders as product_has_orders_service
)

# Create router
router = APIRouter(prefix="/products", tags=["Products"])


@router.post(
    path = "/list",
    response_model = SuccessResponse[Pagination[Product]],
)
async def list_products(
    page: int = 1,
    size: int = 10,
    filters: Optional[Dict[str, Any]] = None,
    sort: Optional[List[SortParam]] = None
) -> SuccessResponse[Pagination[Product]]:
    """
    List all products in the database with pagination, filtering and sorting.

    Parameters:
    - page (int): The page number to retrieve (default is 1).
    - size (int): The number of items per page (default is 10).
    - filters (Optional[Dict[str, Any]]): The filters to apply to the query.
    - sort (Optional[List[SortParam]]): The sorting options for the query.

    Returns:
    - SuccessResponse[Pagination[Product]]: The paginated list of products.
    """

    # Create the query parameters
    params = ListingQueryParams(page=page, size=size, filters=filters, sort=sort)

    # Call the service to list products
    products = await list_products_service(params)

    # Return the success response
    return SuccessResponse(data=products)


@router.get(
    path = "/{product_id}",
    response_model = SuccessResponse[Product]
)
async def get_product_by_id(product_id: int) -> SuccessResponse[Product]:
    """
    Get a product by ID.

    Parameters:
    - product_id (int): The ID of the product to retrieve.

    Returns:
    - SuccessResponse[Product]: The retrieved product.
    """

    # Call the service to get the product
    product = await get_product_by_id_service(product_id)

    # Check if the product was found
    if not product:
        # Raise a 404 error if the product was not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prodotto non trovato")

    # Return the success response
    return SuccessResponse(data=product)


@router.post(
    path = "/",
    response_model = SuccessResponse[Product],
    status_code = status.HTTP_201_CREATED,
)
async def create_product(product_create: ProductCreate) -> SuccessResponse[Product]:
    """
    Create a new product.

    Parameters:
    - product_create (ProductCreate): The product data to create.

    Returns:
    - SuccessResponse[Product]: The created product.
    """

    try:
        # Call the service to create the product
        created = await create_product_service(product_create)
        
    except IntegrityError:
        # Handle SQLAlchemy IntegrityError for duplicate insertions
        raise HTTPException(
            status_code = status.HTTP_409_CONFLICT,
            detail = "Prodotto già esistente o viola il vincolo di unicità"
        )
        
    # Check if the product was created
    if not created:
        # Raise a 500 error if the product was not created
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Errore nella creazione del prodotto")

    # Return the success response
    return SuccessResponse(data=created)


@router.patch(
    path = "/{product_id}",
    response_model = SuccessResponse[Product],
)
async def update_product(product_id: int, product_update: ProductUpdate) -> SuccessResponse[Product]:
    """
    Update an existing product.

    Parameters:
    - product_id (int): The ID of the product to update.
    - product_update (ProductUpdate): The updated product data.

    Returns:
    - SuccessResponse[Product]: The updated product.
    """

    try:
        # Call the service to update the product
        updated = await update_product_service(product_id, product_update)

    except IntegrityError:
        # Handle SQLAlchemy IntegrityError for duplicate updates
        raise HTTPException(
            status_code = status.HTTP_409_CONFLICT,
            detail = "Prodotto già esistente o viola il vincolo di unicità"
        )

    # Check if the product was found
    if not updated:
        # Raise a 404 error if the product was not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prodotto non trovato")

    # Return the success response
    return SuccessResponse(data=updated)


@router.delete(
    path = "/{product_id}",
    response_model = SuccessResponse[None],
)
async def delete_product(product_id: int) -> SuccessResponse[None]:
    """
    Delete a product by ID.

    Parameters:
    - product_id (int): The ID of the product to delete.

    Returns:
    - SuccessResponse[None]: Indicates that the product was deleted successfully.
    """

    # Check if the product has associated orders
    if await product_has_orders_service(product_id):
        # Raise a 409 error if the product has orders
        raise HTTPException(
            status_code = status.HTTP_409_CONFLICT,
            detail = "Il prodotto non può essere eliminato perché è referenziato da ordini esistenti"
        )

    # Call the service to delete the product
    deleted = await delete_product_service(product_id)

    # Check if the product was found
    if not deleted:
        # Raise a 404 error if the product was not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prodotto non trovato")

    # Return the success response
    return SuccessResponse(data=None)