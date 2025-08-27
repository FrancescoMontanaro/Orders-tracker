from fastapi import APIRouter

from ....core.response_models import SuccessResponse
from .models import DailySummaryRequest, DailySummary
from .service import daily_summary as daily_summary_service

# Router for widget-related endpoints
router = APIRouter(prefix="/widgets", tags=["Widgets"])


@router.post(
    path = "/daily-summary",
    response_model = SuccessResponse[list[DailySummary]]
)
async def daily_summary(payload: DailySummaryRequest) -> SuccessResponse[list[DailySummary]]:
    """
    Get the daily summary of orders.

    Parameters:
    - payload: The request payload containing the date range for the summary.

    Returns:
    - A list of daily summaries for the specified date range.
    """

    # Call the service to get the daily summary data
    data = await daily_summary_service(payload)

    # Return the success response
    return SuccessResponse(data=data)