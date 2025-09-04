from datetime import date
from typing import Optional, Dict, List, Any
from fastapi import APIRouter, status, HTTPException, Query

from .models import Order, OrderCreate, OrderUpdate
from ....core.response_models import SuccessResponse
from ....models import Pagination, SortParam, ListingQueryParams

# Import services
from .service import (
    list_orders as list_orders_service,
    get_order_by_id as get_order_by_id_service,
    create_order as create_order_service,
    update_order as update_order_service,
    delete_order as delete_order_service,
)

# Create the router
router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post(
    path = "/list",
    response_model = SuccessResponse[Pagination[Order]]
)
async def list_orders(
    page: int = 1,
    size: int = 10,
    filters: Optional[Dict[str, Any]] = None,
    sort: Optional[List[SortParam]] = None,
    delivery_date_after: Optional[date] = Query(default=None, description="Optional filter for orders delivered after this date"),
    delivery_date_before: Optional[date] = Query(default=None, description="Optional filter for orders delivered before this date"),
) -> SuccessResponse[Pagination[Order]]:
    """
    List orders with pagination, filtering, and sorting.
    Optionally filter by delivery_date (calendar view).
    
    Parameters:
    - page (int): The page number to retrieve (default is 1).
    - size (int): The number of items per page (default is 10).
    - filters (Optional[Dict[str, Any]]): The filters to apply to the query.
    - sort (Optional[List[SortParam]]): The sorting parameters.
    - delivery_date_after (Optional[date]): Optional filter for orders delivered after this date.
    - delivery_date_before (Optional[date]): Optional filter for orders delivered before this date.
    """

    # If delivery_date_after is provided, add it to filters
    if delivery_date_after:
        # Merge delivery_date_after into filters
        filters = (filters or {}) | {"delivery_date_after": delivery_date_after.isoformat()}

    # If delivery_date_before is provided, add it to filters
    if delivery_date_before:
        # Merge delivery_date_before into filters
        filters = (filters or {}) | {"delivery_date_before": delivery_date_before.isoformat()}

    # Create the listing query parameters
    params = ListingQueryParams(page=page, size=size, filters=filters, sort=sort)

    # Call the service to list orders
    data = await list_orders_service(params)

    # Return the success response
    return SuccessResponse(data=data)


@router.get(
    path = "/{order_id}",
    response_model = SuccessResponse[Order]
)
async def get_order_by_id(order_id: int) -> SuccessResponse[Order]:
    """
    Get order details by id.
    
    Parameters:
    - order_id (int): The ID of the order to retrieve.

    Returns:
    - SuccessResponse[Order]: The response containing the order details.
    """

    # Get the order by ID
    order = await get_order_by_id_service(order_id)

    # Check if the order exists
    if not order:
        # Order not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ordine non trovato")

    # Return the success response
    return SuccessResponse(data=order)


@router.post(
    path = "/",
    response_model = SuccessResponse[Order],
    status_code = status.HTTP_201_CREATED
)
async def create_order(payload: OrderCreate) -> SuccessResponse[Order]:
    """
    Create order with items; snapshot unit_price and compute total_amount.

    Parameters:
    - payload (OrderCreate): The order data to create.

    Returns:
    - SuccessResponse[Order]: The response containing the created order.
    """
    
    try:
        # Create the order
        order = await create_order_service(payload)

    # Handle validation errors
    except ValueError as e:
        # Handle validation errors
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
    # Check if the order was created
    if not order:
        # Order not created
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Errore nella creazione dell'ordine")

    # Return the success response
    return SuccessResponse(data=order)


@router.patch(
    path = "/{order_id}",
    response_model = SuccessResponse[Order]
)
async def update_order(order_id: int, payload: OrderUpdate) -> SuccessResponse[Order]:
    """
    Update order (delivery date and/or replace items).

    Parameters:
    - order_id (int): The ID of the order to update.
    - payload (OrderUpdate): The updated order data.

    Returns:
    - SuccessResponse[Order]: The response containing the updated order.
    """
    
    try:
        # Update the order
        updated = await update_order_service(order_id, payload)

    # Handle validation errors
    except ValueError as e:
        # Handle validation errors
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Check if the order was updated
    if not updated:
        # Order not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ordine non trovato")

    # Return the success response
    return SuccessResponse(data=updated)


@router.delete(
    path = "/{order_id}",
    response_model = SuccessResponse[None]
)
async def delete_order(order_id: int) -> SuccessResponse[None]:
    """
    Delete order by id.

    Parameters:
    - order_id (int): The ID of the order to delete.

    Returns:
    - SuccessResponse[None]: The response indicating the order was deleted.
    """
    
    # Delete the order
    deleted = await delete_order_service(order_id)

    # Check if the order was deleted
    if not deleted:
        # Order not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ordine non trovato")

    # Return the success response
    return SuccessResponse(data=None)