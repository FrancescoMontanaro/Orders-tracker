from pydantic import BaseModel
from typing import Optional, Generic, TypeVar


# Create a type variable
T = TypeVar("T")

class SuccessResponse(BaseModel, Generic[T]):
    """
    Represents a successful response.

    Attributes:
        status (str): The status of the response.
        data (Optional[dict]): The data returned in the response.
    """

    status: str = "success"
    data: Optional[T] = None