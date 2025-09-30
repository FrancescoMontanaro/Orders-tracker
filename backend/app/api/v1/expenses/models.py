from datetime import date
from pydantic import BaseModel, Field
from typing import Optional, TypeVar, Generic

from ....models.pagination import Pagination

# Define a type variable for the pagination response
T = TypeVar("T")


# ==================== #
# ===== Expenses ===== #
# ==================== #

class PaginationExpense(Pagination["Expense"], Generic[T]):
    """
    Pagination response model for expenses.
    """
    
    total_amount: float = 0.0
    

class Expense(BaseModel):
    """
    Represents an expense in the system.
    """
    
    id: int
    category_id: int
    timestamp: date
    amount: float
    note: Optional[str] = None
    category: str

    # Expense configuration
    class Config:
        from_attributes = True


class ExpenseCreate(BaseModel):
    """
    Represents a request to create a new expense.
    """
    
    category_id: int
    timestamp: date
    amount: float = Field(gt=0, description="Expense amount must be > 0")
    note: Optional[str] = None


class ExpenseUpdate(BaseModel):
    """
    Represents a request to update an existing expense.
    """
    
    category_id: Optional[int] = None
    timestamp: Optional[date] = None
    amount: Optional[float] = Field(default=None, gt=0)
    note: Optional[str] = None
    
    
# =============================== #
# ===== Expenses categories ===== #
# =============================== #

class ExpenseCategory(BaseModel):
    """
    Represents an expense category in the system.
    """
    
    id: int
    descr: str
    
    # Expense category configuration
    class Config:
        from_attributes = True
    
    
class ExpenseCategoryCreate(BaseModel):
    """
    Represents a request to create a new expense category.
    """

    descr: str


class ExpenseCategoryUpdate(BaseModel):
    """
    Represents a request to update an existing expense category.
    """

    descr: Optional[str] = None