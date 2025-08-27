from fastapi import APIRouter

from ....core.response_models import SuccessResponse

# Define router
router = APIRouter(tags=["Base"])

# Define health check endpoint
@router.get("/health", response_model=SuccessResponse)
@router.get("/", response_model=SuccessResponse)
def health() -> SuccessResponse:
    """
    Health check endpoint.

    Returns:
        SuccessResponse: The health check response.
    """

    # Return health check status
    return SuccessResponse()