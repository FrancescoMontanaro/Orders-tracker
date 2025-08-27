from sqlalchemy.exc import IntegrityError
from typing import Optional, Dict, List, Any
from fastapi import APIRouter, status, HTTPException

from ....core.response_models import SuccessResponse
from .models import Customer, CustomerCreate, CustomerUpdate
from ....models import Pagination, SortParam, ListingQueryParams

# Import service functions
from .service import (
    list_customers as list_customers_service,
    get_customer_by_id as get_customer_by_id_service,
    create_customer as create_customer_service,
    update_customer as update_customer_service,
    delete_customer as delete_customer_service,
    customer_has_orders as customer_has_orders_service
)

# Create router
router = APIRouter(prefix="/customers", tags=["Customers"])


@router.post(
    path = "/list",
    response_model = SuccessResponse[Pagination[Customer]]
)
async def list_customers(
    page: int = 1,
    size: int = 10,
    filters: Optional[Dict[str, Any]] = None,
    sort: Optional[List[SortParam]] = None
) -> SuccessResponse[Pagination[Customer]]:
    """
    List all customers in the database.

    Parameters:
    - page (int): The page number.
    - size (int): The number of items per page.
    - filters (dict[str, Any], optional): The filters to apply.
    - sort (list[SortParam], optional): The sorting parameters.

    Returns:
    - Pagination[Customer]: A paginated list of customers.
    """

    # Create the query parameters object
    params = ListingQueryParams(page=page, size=size, filters=filters, sort=sort)
    
    # Call the service function to get the list of customers
    customers = await list_customers_service(params)

    # Return customer data
    return SuccessResponse(data=customers)


@router.get(
    path = "/{customer_id}",
    response_model = SuccessResponse[Customer]
)
async def get_customer_by_id(customer_id: int) -> SuccessResponse[Customer]:
    """
    Get a customer by ID.

    Args:
        customer_id (int): The ID of the customer to retrieve.

    Returns:
        SuccessResponse[Customer]: The retrieved customer.
    """

    # Call the service function to get the customer by ID
    customer = await get_customer_by_id_service(customer_id)

    # Check if the customer was found
    if not customer:
        # Raise a 404 error if the customer was not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente non trovato")

    # Return customer data
    return SuccessResponse(data=customer)


@router.post(
    path = "/",
    response_model = SuccessResponse[Customer],
    status_code = status.HTTP_201_CREATED
)
async def create_customer(customer_create: CustomerCreate) -> SuccessResponse[Customer]:
    """
    Create a new customer in the database.

    Args:
        customer_create (CustomerCreate): The customer data to create.

    Returns:
        SuccessResponse[Customer]: The created customer.
    """
    
    try:
        # Call the service function to create the customer
        created_customer = await create_customer_service(customer_create)
    except IntegrityError:
        # Handle SQLAlchemy IntegrityError for duplicate insertions
        raise HTTPException(
            status_code = status.HTTP_409_CONFLICT,
            detail = "Cliente già esistente o violazione del vincolo di unicità"
        )

    # Return the created customer
    return SuccessResponse(data=created_customer)


@router.patch(
    path = "/{customer_id}",
    response_model = SuccessResponse[Customer]
)
async def update_customer(customer_id: int, customer_update: CustomerUpdate) -> SuccessResponse[Customer]:
    """
    Update an existing customer in the database.

    Args:
        customer_id (int): The ID of the customer to update.
        customer_update (CustomerUpdate): The updated customer data.

    Returns:
        SuccessResponse[Customer]: The updated customer.
    """

    try:
        # Call the service function to update the customer
        updated_customer = await update_customer_service(customer_id, customer_update)
    except IntegrityError:
        # Handle SQLAlchemy IntegrityError for duplicate updates
        raise HTTPException(
            status_code = status.HTTP_409_CONFLICT,
            detail = "Cliente già esistente o violazione del vincolo di unicità"
        )

    # Check if the customer was found
    if not updated_customer:
        # Raise a 404 error if the customer was not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente non trovato")

    # Return the updated customer
    return SuccessResponse(data=updated_customer)


@router.delete(
    path = "/{customer_id}",
    response_model = SuccessResponse[None]
)
async def delete_customer(customer_id: int) -> SuccessResponse[None]:
    """
    Delete a customer by ID.

    Args:
        customer_id (int): The ID of the customer to delete.

    Returns:
        SuccessResponse[None]: A success response indicating the customer was deleted.
    """

    # Check if the customer has associated orders
    if await customer_has_orders_service(customer_id):
        # Raise a 409 error if the customer has orders
        raise HTTPException(
            status_code = status.HTTP_409_CONFLICT,
            detail = "Il cliente non può essere eliminato perché è referenziato da ordini esistenti"
        )

    # Call the service function to delete the customer
    deleted = await delete_customer_service(customer_id)

    # Check if the customer was found
    if not deleted:
        # Raise a 404 error if the customer was not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente non trovato")

    # Return a success response
    return SuccessResponse(data=None)