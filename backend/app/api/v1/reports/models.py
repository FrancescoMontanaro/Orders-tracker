from datetime import date
from pydantic import BaseModel
from typing import List, Optional

### Common Models ###

class DateRange(BaseModel):
    """
    Represents a date range for filtering reports.
    """
    
    start_date: date
    end_date: date


### Product Sales ###

class ProductSalesRow(BaseModel):
    """
    Represents a row in the product sales report.
    """
    
    product_id: int
    product_name: str
    total_qty: float
    unit: str
    revenue: float


class ProductSalesRequest(DateRange):
    """
    Represents a request for product sales data within a date range.
    """

    product_ids: Optional[list[int]] = None


### Expenses Categories ###

class ExpensesCategoriesRequest(DateRange):
    """
    Represents a request for expenses data within a date range.
    """
    
    category_ids: Optional[list[int]] = None

class ExpenseCategoriesRow(BaseModel):
    """
    Represents a row in the expenses report.
    """
    
    category_id: int
    category_descr: str
    amount: float
    count: int
    
    
### Incomes Categories ###

class IncomeCategoriesRequest(DateRange):
    """
    Represents a request for expenses data within a date range.
    """
    
    category_ids: Optional[list[int]] = None

class IncomeCategoriesRow(BaseModel):
    """
    Represents a row in the income report.
    """
    
    category_id: int
    category_descr: str
    amount: float
    count: int


### Customer Sales ###

class CustomerSalesRow(BaseModel):
    """
    Represents a row in the customer sales report.
    """
    
    product_id: int
    product_name: str
    total_qty: float
    unit: str
    avg_discount: float
    revenue: float


class CustomerSalesResponse(BaseModel):
    """
    Represents a response containing customer sales data.
    """
    
    customer_id: Optional[int]
    customer_name: Optional[str]
    total_revenue: float
    per_product: List[CustomerSalesRow]


class CustomerSalesRequest(DateRange):
    """
    Represents a request for customer sales data within a date range.
    """
    
    customer_id: int


### Cash Flow ###

class CashEntry(BaseModel):
    """
    Represents a cash entry in the cash flow report.
    """
    
    order_id: int
    date: date
    amount: float


class CashExpense(BaseModel):
    """
    Represents a cash expense in the cash flow report.
    """
    
    id: int
    date: date
    amount: float
    note: Optional[str] = None


class CashIncome(BaseModel):
    """
    Represents a cash income in the cash flow report.
    """
    
    id: int
    date: date
    amount: float
    note: Optional[str] = None


class CashflowResponse(BaseModel):
    """
    Represents a response containing cash flow data.
    """
    
    entries_total: float
    expenses_total: float
    net: float
    entries: List[CashEntry]
    expenses: List[CashExpense]
    incomes: List[CashIncome]


class CashflowRequest(DateRange):
    """
    Represents a request for cash flow data within a date range.
    """
    
    include_incomes: bool = True