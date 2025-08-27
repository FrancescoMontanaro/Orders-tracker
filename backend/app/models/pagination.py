from pydantic import BaseModel
from typing import Generic, List, TypeVar, Optional, Dict, Literal, Any


# Define a type variable for the pagination response
T = TypeVar("T")


class Pagination(BaseModel, Generic[T]):
    """
    Pagination response model.

    Attributes:
        total (int): The total number of items.
        items (list[BaseModel]): The list of items on the current page.
    """
    
    total: int
    items: List[T] = []
    
    
class SortParam(BaseModel):
    """
    Sorting parameter model.

    Attributes:
        field (str): The field to sort by.
        order (str): The sort order ("asc" or "desc").
    """
    
    field: str
    order: Literal["asc", "desc"] = "asc"


class ListingQueryParams(BaseModel):
    """
    Query parameters for pagination, filtering, and sorting.

    Attributes:
        page (int): The page number.
        size (int): The number of items per page.
        filters (dict[str, str]): The filters to apply.
        sort (list[SortParam]): The sorting parameters.
    """
    
    page: int = 1
    size: int = 10
    filters: Optional[Dict[str, Any]] = None
    sort: Optional[List[SortParam]] = None