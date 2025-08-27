from typing import List
from datetime import date
from pydantic import BaseModel


class DateRange(BaseModel):
    """
    Date range for filtering reports.
    """
    
    start_date: date
    end_date: date


class DailyCustomerBreakdown(BaseModel):
    """
    Daily breakdown of sales by customer.
    """
    
    customer_id: int
    customer_name: str
    quantity: float
    order_status: str


class DailyProductSummary(BaseModel):
    """
    Daily summary of sales by product.
    """
    
    product_id: int
    product_name: str
    total_qty: float
    product_unit: str
    customers: List[DailyCustomerBreakdown]


class DailySummary(BaseModel):
    """
    Daily summary of sales.
    """
    
    date: date
    products: List[DailyProductSummary]


class DailySummaryRequest(DateRange):
    """
    Request body per il widget giornaliero.
    """
    
    pass