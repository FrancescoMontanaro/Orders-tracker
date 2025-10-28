from datetime import date
from sqlalchemy.exc import IntegrityError
from typing import Optional, Dict, List, Any
from fastapi import APIRouter, status, HTTPException, Query

from .models import Lot, LotCreate, LotUpdate
from .service import (
    list_lots as list_lots_service,
    get_lot_by_id as get_lot_by_id_service,
    create_lot as create_lot_service,
    update_lot as update_lot_service,
    delete_lot as delete_lot_service,
)
from ....core.response_models import SuccessResponse
from ....models import Pagination, SortParam, ListingQueryParams

# Create the router
router = APIRouter(prefix="/lots", tags=["Lots"])


@router.post(
    path = "/list",
    response_model = SuccessResponse[Pagination[Lot]]
)
async def list_lots(
    page: int = 1,
    size: int = 10,
    filters: Optional[Dict[str, Any]] = None,
    sort: Optional[List[SortParam]] = None,
    lot_date_after: Optional[date] = Query(default=None, description="Optional filter for lots with lot_date after or equal to this date"),
    lot_date_before: Optional[date] = Query(default=None, description="Optional filter for lots with lot_date before or equal to this date"),
) -> SuccessResponse[Pagination[Lot]]:
    """
    List lots with pagination, filtering, and sorting.

    Parameters:
    - page (int): Page number (default 1).
    - size (int): Number of items per page (default 10).
    - filters (Optional[Dict[str, Any]]): Additional filters to apply.
    - sort (Optional[List[SortParam]]): Sorting parameters.
    - lot_date_after (Optional[date]): Filter for lots with lot_date after or equal to this date.
    - lot_date_before (Optional[date]): Filter for lots with lot_date before or equal to this date.

    Returns:
    - SuccessResponse[Pagination[Lot]]: Paginated list of lots.
    """

    # Merge ad-hoc filters into the filters dict
    if lot_date_after is not None:
        filters = (filters or {}) | {"lot_date_after": lot_date_after.isoformat()}
    if lot_date_before is not None:
        filters = (filters or {}) | {"lot_date_before": lot_date_before.isoformat()}

    # Create the listing query parameters
    params = ListingQueryParams(page=page, size=size, filters=filters, sort=sort)

    # Call the service to list lots
    data = await list_lots_service(params)

    # Return success response
    return SuccessResponse(data=data)


@router.get(
    path = "/{lot_id}",
    response_model = SuccessResponse[Lot]
)
async def get_lot_by_id(lot_id: int) -> SuccessResponse[Lot]:
    """
    Retrieve a single lot by its ID.

    Parameters:
    - lot_id (int): The ID of the lot to retrieve.

    Returns:
    - SuccessResponse[Lot]: The requested lot.
    """

    # Call the service to get the lot
    lot = await get_lot_by_id_service(lot_id)

    # Handle not found
    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lotto non trovato")

    # Return success response
    return SuccessResponse(data=lot)


@router.post(
    path = "/",
    response_model = SuccessResponse[Lot],
    status_code = status.HTTP_201_CREATED
)
async def create_lot(payload: LotCreate) -> SuccessResponse[Lot]:
    """
    Create a new lot and optionally associate order items.

    Parameters:
    - payload (LotCreate): The lot data and associations.

    Returns:
    - SuccessResponse[Lot]: The created lot.
    """

    try:
        # Call the service to create the lot
        lot = await create_lot_service(payload)

    except IntegrityError:
        # Handle unique constraint violation (name)
        raise HTTPException(
            status_code = status.HTTP_409_CONFLICT,
            detail = "Esiste già un lotto con questo nome"
        )

    except ValueError as exc:
        # Handle missing references or validation errors
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    # Safeguard unexpected failures
    if not lot:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Errore nella creazione del lotto")

    # Return success response
    return SuccessResponse(data=lot)


@router.patch(
    path = "/{lot_id}",
    response_model = SuccessResponse[Lot]
)
async def update_lot(lot_id: int, payload: LotUpdate) -> SuccessResponse[Lot]:
    """
    Update an existing lot and its associated order items.

    Parameters:
    - lot_id (int): The ID of the lot to update.
    - payload (LotUpdate): The data to update.

    Returns:
    - SuccessResponse[Lot]: The updated lot.
    """

    try:
        # Call the service to update the lot
        lot = await update_lot_service(lot_id, payload)

    except IntegrityError:
        raise HTTPException(
            status_code = status.HTTP_409_CONFLICT,
            detail = "Esiste già un lotto con questo nome"
        )

    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    if not lot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lotto non trovato")

    return SuccessResponse(data=lot)


@router.delete(
    path = "/{lot_id}",
    response_model = SuccessResponse[None]
)
async def delete_lot(lot_id: int) -> SuccessResponse[None]:
    """
    Delete a lot and detach associated order items.

    Parameters:
    - lot_id (int): The ID of the lot to delete.

    Returns:
    - SuccessResponse[None]: Indicates successful deletion.
    """

    deleted = await delete_lot_service(lot_id)

    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lotto non trovato")

    return SuccessResponse(data=None)
