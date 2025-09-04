from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel, Field


class OrderItem(BaseModel):
    """
    A single line of an order (product + quantity + unit price snapshot).
    """
    
    id: int
    product_id: int
    product_name: str
    unit: str
    quantity: float
    unit_price: float

    # Pydantic config
    class Config:
        from_attributes = True


class Order(BaseModel):
    """
    The order entity exposed via API.
    """
    
    id: int
    customer_id: int
    delivery_date: date
    created_at: datetime
    total_amount: float
    applied_discount: float
    status: str
    items: List[OrderItem] = []
    customer_name: Optional[str] = None

    # Pydantic config
    class Config:
        from_attributes = True


class OrderItemCreate(BaseModel):
    """
    Payload for creating an order item.
    """
    
    product_id: int
    quantity: float = Field(gt=0)
    unit_price: Optional[float] = Field(default=None, gt=0)


class OrderCreate(BaseModel):
    """
    Payload for creating a new order with its items.
    """
    
    customer_id: int
    delivery_date: date
    applied_discount: float = Field(default=0, ge=0, le=100)
    items: List[OrderItemCreate]


class OrderUpdateItem(BaseModel):
    """
    Optional update to an item (supports partial updates).
    """

    product_id: Optional[int] = None
    quantity: Optional[float] = Field(default=None, gt=0)


class OrderUpdate(BaseModel):
    """
    Partial update for an order (date and/or items).
    If items provided, they fully replace existing items.
    """

    delivery_date: Optional[date] = None
    items: Optional[List[OrderItemCreate]] = None
    customer_id: Optional[int] = None
    applied_discount: Optional[float] = Field(default=None, ge=0, le=100)
    status: Optional[str] = None