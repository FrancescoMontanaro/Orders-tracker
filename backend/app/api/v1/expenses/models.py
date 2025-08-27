from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class Expense(BaseModel):
    """
    Represents an expense in the system.
    """
    
    id: int
    timestamp: date
    amount: float
    note: Optional[str] = None

    # Expense configuration
    class Config:
        from_attributes = True


class ExpenseCreate(BaseModel):
    """
    Represents a request to create a new expense.
    """
    
    timestamp: date
    amount: float = Field(gt=0, description="Expense amount must be > 0")
    note: Optional[str] = None


class ExpenseUpdate(BaseModel):
    """
    Represents a request to update an existing expense.
    """
    
    timestamp: Optional[date] = None
    amount: Optional[float] = Field(default=None, gt=0)
    note: Optional[str] = None