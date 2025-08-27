from datetime import date
from typing import Optional, Dict, List, Any
from fastapi import APIRouter, status, HTTPException, Query

from ....core.response_models import SuccessResponse
from .models import Expense, ExpenseCreate, ExpenseUpdate
from ....models import Pagination, SortParam, ListingQueryParams

# Services
from .service import (
    list_expenses as list_expenses_service,
    get_expense_by_id as get_expense_by_id_service,
    create_expense as create_expense_service,
    update_expense as update_expense_service,
    delete_expense as delete_expense_service,
)


# Create the router
router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.post(
    path = "/list",
    response_model = SuccessResponse[Pagination[Expense]]
)
async def list_expenses(
    page: int = 1,
    size: int = 10,
    filters: Optional[Dict[str, Any]] = None,
    sort: Optional[List[SortParam]] = None,
    timestamp_after: Optional[date] = Query(default=None, description="Optional filter for expenses created after this date"),
    timestamp_before: Optional[date] = Query(default=None, description="Optional filter for expenses created before this date"),
    min_amount: Optional[float] = Query(default=None, description="Optional filter for minimum expense amount"),
    max_amount: Optional[float] = Query(default=None, description="Optional filter for maximum expense amount"),
) -> SuccessResponse[Pagination[Expense]]:
    """
    List expenses with pagination, filtering and sorting.

    Params:
    - page: The page number.
    - size: The page size.
    - filters: The filters to apply.
    - sort: The sorting options.
    - timestamp_after: Optional filter for expenses created after this date.
    - timestamp_before: Optional filter for expenses created before this date.
    - min_amount: Optional filter for minimum expense amount.
    - max_amount: Optional filter for maximum expense amount.

    Returns:
    - A paginated list of expenses.
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
    data = await list_expenses_service(params)

    # Return the response
    return SuccessResponse(data=data)


@router.get(
    path = "/{expense_id}",
    response_model = SuccessResponse[Expense],
)
async def get_expense_by_id(expense_id: int) -> SuccessResponse[Expense]:
    """
    Get an expense by ID.

    Params:
        - expense_id: The ID of the expense.

    Returns:
        - The expense with the given ID.
    """

    # Call the service
    expense = await get_expense_by_id_service(expense_id)

    # Check if the expense was found
    if not expense:
        # Raise a 404 error if not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Spesa non trovata")

    # Return the response
    return SuccessResponse(data=expense)


@router.post(
    path = "/",
    response_model = SuccessResponse[Expense],
    status_code = status.HTTP_201_CREATED,
)
async def create_expense(expense_create: ExpenseCreate) -> SuccessResponse[Expense]:
    """
    Create a new expense.

    Params:
    - expense_create: The expense data to create.

    Returns:
    - The created expense.
    """

    # Call the service
    created = await create_expense_service(expense_create)

    # Return the response
    return SuccessResponse(data=created)


@router.patch(
    path = "/{expense_id}",
    response_model = SuccessResponse[Expense],
)
async def update_expense(expense_id: int, expense_update: ExpenseUpdate) -> SuccessResponse[Expense]:
    """
    Update an existing expense.

    Params:
    - expense_id: The ID of the expense to update.
    - expense_update: The updated expense data.

    Returns:
    - The updated expense.
    """

    # Call the service
    updated = await update_expense_service(expense_id, expense_update)

    # Check if the expense was found
    if not updated:
        # Raise a 404 error if not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Spesa non trovata")

    # Return the response
    return SuccessResponse(data=updated)


@router.delete(
    path = "/{expense_id}",
    response_model = SuccessResponse[None],
)
async def delete_expense(expense_id: int) -> SuccessResponse[None]:
    """
    Delete an expense by ID.

    Params:
    - expense_id: The ID of the expense to delete.
    """
    
    # Call the service to delete the expense
    deleted = await delete_expense_service(expense_id)

    # Check if the expense was found
    if not deleted:
        # Raise a 404 error if not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Spesa non trovata")

    # Return the response
    return SuccessResponse(data=None)