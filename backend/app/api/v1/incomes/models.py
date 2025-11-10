from datetime import date
from pydantic import BaseModel, Field
from typing import Optional, TypeVar, Generic

from ....models.pagination import Pagination

# Define a type variable for the pagination response
T = TypeVar("T")


# ==================== #
# ===== Incomes ===== #
# ==================== #

class PaginationIncome(Pagination["Income"], Generic[T]):
    """
    Pagination response model for incomes.
    """
    
    total_amount: float = 0.0
    

class Income(BaseModel):
    """
    Represents an income in the system.
    """
    
    id: int
    category_id: int
    timestamp: date
    amount: float
    note: Optional[str] = None
    category: str

    # Income configuration
    class Config:
        from_attributes = True


class IncomeCreate(BaseModel):
    """
    Represents a request to create a new income.
    """
    
    category_id: int
    timestamp: date
    amount: float = Field(gt=0, description="Income amount must be > 0")
    note: Optional[str] = None


class IncomeUpdate(BaseModel):
    """
    Represents a request to update an existing income.
    """
    
    category_id: Optional[int] = None
    timestamp: Optional[date] = None
    amount: Optional[float] = Field(default=None, gt=0)
    note: Optional[str] = None
    
    
# =============================== #
# ===== Incomes categories ====== #
# =============================== #

class IncomeCategory(BaseModel):
    """
    Represents an income category in the system.
    """
    
    id: int
    descr: str

    # Income category configuration
    class Config:
        from_attributes = True


class IncomeCategoryCreate(BaseModel):
    """
    Represents a request to create a new income category.
    """

    descr: str


class IncomeCategoryUpdate(BaseModel):
    """
    Represents a request to update an existing income category.
    """

    descr: Optional[str] = None