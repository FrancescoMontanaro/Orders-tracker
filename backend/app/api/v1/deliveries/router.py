from datetime import date
from fastapi import APIRouter, Query

from .models import DailyDeliveries
from ....core.response_models import SuccessResponse
from .service import get_daily_deliveries as get_daily_deliveries_service

# Create the router
router = APIRouter(prefix="/deliveries", tags=["Deliveries"])


@router.get(
    path = "/daily",
    response_model = SuccessResponse[DailyDeliveries]
)
async def daily_deliveries(
    delivery_date: date = Query(..., description="The delivery date to summarise")
) -> SuccessResponse[DailyDeliveries]:
    """
    Get the products to deliver on a given day, grouped by order.
    Quantities only: no prices and no customer data are returned.

    Parameters:
    - delivery_date (date): The delivery date to summarise.

    Returns:
    - SuccessResponse[DailyDeliveries]: The delivery summary of the day.
    """

    # Build the summary through the service
    data = await get_daily_deliveries_service(delivery_date)

    # Return the success response
    return SuccessResponse(data=data)
