from datetime import date
from typing import Optional, Dict, List, Any
from fastapi import APIRouter, status, HTTPException, Query

from ....core.response_models import SuccessResponse
from ....models import Pagination, SortParam, ListingQueryParams
from .models import Income, IncomeCreate, IncomeUpdate, PaginationIncome, IncomeCategory, IncomeCategoryCreate, IncomeCategoryUpdate

# Services
from .service import (
    list_incomes as list_incomes_service,
    get_income_by_id as get_income_by_id_service,
    create_income as create_income_service,
    update_income as update_income_service,
    delete_income as delete_income_service,
    list_income_categories as list_income_categories_service,
    get_income_category_by_id as get_income_category_by_id_service,
    create_income_category as create_income_category_service,
    update_income_category as update_income_category_service,
    delete_income_category as delete_income_category_service,
    category_has_incomes as category_has_incomes_service
)


# Create the router
router = APIRouter(prefix="/incomes", tags=["Incomes"])

# =================== #
# ===== Incomes ===== #
# =================== #

@router.post(
    path = "/list",
    response_model = SuccessResponse[PaginationIncome[Income]]
)
async def list_incomes(
    page: int = 1,
    size: int = 10,
    filters: Optional[Dict[str, Any]] = None,
    sort: Optional[List[SortParam]] = None,
    timestamp_after: Optional[date] = Query(default=None, description="Optional filter for incomes created after this date"),
    timestamp_before: Optional[date] = Query(default=None, description="Optional filter for incomes created before this date"),
    min_amount: Optional[float] = Query(default=None, description="Optional filter for minimum income amount"),
    max_amount: Optional[float] = Query(default=None, description="Optional filter for maximum income amount"),
) -> SuccessResponse[PaginationIncome[Income]]:
    """
    List incomes with pagination, filtering and sorting.

    Params:
    - page: The page number.
    - size: The page size.
    - filters: The filters to apply.
    - sort: The sorting options.
    - timestamp_after: Optional filter for incomes created after this date.
    - timestamp_before: Optional filter for incomes created before this date.
    - min_amount: Optional filter for minimum income amount.
    - max_amount: Optional filter for maximum income amount.

    Returns:
    - A paginated list of incomes.
    """

    # If timestamp_after is provided, add it to filters
    if timestamp_after:
        # Merge timestamp_after into filters
        filters = (filters or {}) | {"timestamp_after": timestamp_after.isoformat()}

    # If timestamp_before is provided, add it to filters
    if timestamp_before:
        # Merge timestamp_before into filters
        filters = (filters or {}) | {"timestamp_before": timestamp_before.isoformat()}

    # If min_amount is provided, add it to filters
    if min_amount is not None:
        filters = (filters or {}) | {"min_amount": min_amount}

    # If max_amount is provided, add it to filters
    if max_amount is not None:
        filters = (filters or {}) | {"max_amount": max_amount}

    # Create the listing query parameters
    params = ListingQueryParams(page=page, size=size, filters=filters, sort=sort)

    # Create the query parameters
    params = ListingQueryParams(page=page, size=size, filters=filters, sort=sort)

    # Call the service
    data = await list_incomes_service(params)
    
    print(data)

    # Return the response
    return SuccessResponse(data=data)


@router.get(
    path = "/{income_id}",
    response_model = SuccessResponse[Income],
)
async def get_income_by_id(income_id: int) -> SuccessResponse[Income]:
    """
    Get an income by ID.

    Params:
        - income_id: The ID of the income.

    Returns:
        - The income with the given ID.
    """

    # Call the service
    income = await get_income_by_id_service(income_id)

    # Check if the income was found
    if not income:
        # Raise a 404 error if not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrata non trovata")

    # Return the response
    return SuccessResponse(data=income)


@router.post(
    path = "/",
    response_model = SuccessResponse[Income],
    status_code = status.HTTP_201_CREATED,
)
async def create_income(income_create: IncomeCreate) -> SuccessResponse[Income]:
    """
    Create a new income.

    Params:
    - income_create: The income data to create.

    Returns:
    - The created income.
    """

    # Call the service
    created = await create_income_service(income_create)

    # If creation failed, raise an error
    if not created:
        # Raise a 400 error if creation failed
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Errore nella creazione dell'entrata")

    # Return the response
    return SuccessResponse(data=created)


@router.patch(
    path = "/{income_id}",
    response_model = SuccessResponse[Income],
)
async def update_income(income_id: int, income_update: IncomeUpdate) -> SuccessResponse[Income]:
    """
    Update an existing income.

    Params:
    - income_id: The ID of the income to update.
    - income_update: The updated income data.

    Returns:
    - The updated income.
    """

    # Call the service
    updated = await update_income_service(income_id, income_update)

    # Check if the income was found
    if not updated:
        # Raise a 404 error if not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrata non trovata")

    # Return the response
    return SuccessResponse(data=updated)


@router.delete(
    path = "/{income_id}",
    response_model = SuccessResponse[None],
)
async def delete_income(income_id: int) -> SuccessResponse[None]:
    """
    Delete an income by ID.

    Params:
    - income_id: The ID of the income to delete.
    """
    
    # Call the service to delete the income
    deleted = await delete_income_service(income_id)

    # Check if the income was found
    if not deleted:
        # Raise a 404 error if not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrata non trovata")

    # Return the response
    return SuccessResponse(data=None)


# ============================== #
# ===== Incomes categories ===== #
# ============================== #

@router.post(
    path = "/categories/list",
    response_model = SuccessResponse[Pagination[IncomeCategory]],
)
async def list_income_categories(
    page: int = 1,
    size: int = 10,
    filters: Optional[Dict[str, Any]] = None,
    sort: Optional[List[SortParam]] = None,
) -> SuccessResponse[Pagination[IncomeCategory]]:
    """
    List income categories with pagination, filtering and sorting.

    Params:
    - page: The page number.
    - size: The page size.
    - filters: The filters to apply.
    - sort: The sorting options.

    Returns:
    - A paginated list of income categories.
    """

    # Create the listing query parameters
    params = ListingQueryParams(page=page, size=size, filters=filters, sort=sort)

    # Call the service
    data = await list_income_categories_service(params)

    # Return the response
    return SuccessResponse(data=data)


@router.get(
    path = "/categories/{category_id}",
    response_model = SuccessResponse[IncomeCategory],
)
async def get_income_category_by_id(category_id: int) -> SuccessResponse[IncomeCategory]:
    """
    Get an income category by ID.

    Params:
        - category_id: The ID of the income category.

    Returns:
        - The income category with the given ID.
    """

    # Call the service
    category = await get_income_category_by_id_service(category_id)

    # Check if the category was found
    if not category:
        # Raise a 404 error if not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoria di entrata non trovata")

    # Return the response
    return SuccessResponse(data=category)


@router.post(
    path = "/categories/",
    response_model = SuccessResponse[IncomeCategory],
    status_code = status.HTTP_201_CREATED,
)
async def create_income_category(category_create: IncomeCategoryCreate) -> SuccessResponse[IncomeCategory]:
    """
    Create a new income category.

    Params:
    - category_create: The income category data to create.

    Returns:
    - The created income category.
    """

    # Call the service
    created = await create_income_category_service(category_create)

    # If creation failed, raise an error
    if not created:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Errore nella creazione della categoria di entrata")

    # Return the response
    return SuccessResponse(data=created)


@router.patch(
    path = "/categories/{category_id}",
    response_model = SuccessResponse[IncomeCategory],
)
async def update_income_category(category_id: int, category_update: IncomeCategoryUpdate) -> SuccessResponse[IncomeCategory]:
    """
    Update an existing income category.

    Params:
    - category_id: The ID of the income category to update.
    - category_update: The updated income category data.

    Returns:
    - The updated income category.
    """

    # Call the service
    updated = await update_income_category_service(category_id, category_update)

    # Check if the category was found
    if not updated:
        # Raise a 404 error if not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoria di entrata non trovata")

    # Return the response
    return SuccessResponse(data=updated)


@router.delete(
    path = "/categories/{category_id}",
    response_model = SuccessResponse[None],
)
async def delete_income_category(category_id: int) -> SuccessResponse[None]:
    """
    Delete an income category by ID.

    Params:
    - category_id: The ID of the income category to delete.
    """

    # Check if the category has associated incomes
    if await category_has_incomes_service(category_id):
        # Raise a 409 error if the category has incomes
        raise HTTPException(
            status_code = status.HTTP_409_CONFLICT,
            detail = "La categoria non può essere eliminata perché ha entrate associate"
        )

    # Call the service to delete the category
    deleted = await delete_income_category_service(category_id)

    # Check if the category was found
    if not deleted:
        # Raise a 404 error if not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoria di entrata non trovata")

    # Return the response
    return SuccessResponse(data=None)