from fastapi import APIRouter

from ....core.response_models import SuccessResponse

# Importing request and response models
from .models import (
    ProductSalesRequest, ProductSalesRow,
    CustomerSalesRequest, CustomerSalesResponse,
    CashflowRequest, CashflowResponse,
)

# Importing service functions
from .service import (
    report_product_sales as report_product_sales_service,
    report_customer_sales as report_customer_sales_service,
    report_cashflow as report_cashflow_service,
)


# Creating the router
router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post(
    path = "/product-sales",
    response_model = SuccessResponse[list[ProductSalesRow]]
)
async def product_sales(payload: ProductSalesRequest) -> SuccessResponse[list[ProductSalesRow]]:
    """
    Endpoint to get product sales report.

    Parameters:
    - payload: ProductSalesRequest

    Returns:
    - SuccessResponse[list[ProductSalesRow]]
    """

    # Calling the service function
    data = await report_product_sales_service(payload)

    # Returning the response
    return SuccessResponse(data=data)


@router.post(
    path = "/customer-sales",
    response_model = SuccessResponse[CustomerSalesResponse]
)
async def customer_sales(payload: CustomerSalesRequest) -> SuccessResponse[CustomerSalesResponse]:
    """
    Endpoint to get customer sales report.

    Parameters:
    - payload: CustomerSalesRequest

    Returns:
    - SuccessResponse[CustomerSalesResponse]
    """

    # Calling the service function
    data = await report_customer_sales_service(payload)

    # Returning the response
    return SuccessResponse(data=data)


@router.post(
    path = "/cashflow",
    response_model = SuccessResponse[CashflowResponse]
)
async def cashflow(payload: CashflowRequest) -> SuccessResponse[CashflowResponse]:
    """
    Endpoint to get cashflow report.

    Parameters:
    - payload: CashflowRequest

    Returns:
    - SuccessResponse[CashflowResponse]
    """

    # Calling the service function
    data = await report_cashflow_service(payload)

    # Returning the response
    return SuccessResponse(data=data)