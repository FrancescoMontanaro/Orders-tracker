from datetime import date
from typing import List, Optional
from pydantic import BaseModel, Field


class LotOrderItem(BaseModel):
    """
    Represents an order item associated with a lot.
    """
    
    id: int
    order_id: int
    product_id: int
    quantity: float
    unit_price: float
    product_name: Optional[str] = None
    product_unit: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None

    # Pydantic config
    class Config:
        from_attributes = True


class Lot(BaseModel):
    """
    Represents a lot exposed via API.
    """
    
    id: int
    lot_date: date
    name: str
    description: Optional[str] = None
    order_items: List[LotOrderItem] = []

    # Pydantic config
    class Config:
        from_attributes = True


class LotCreate(BaseModel):
    """
    Payload for creating a new lot.
    """
    
    lot_date: date
    name: str = Field(min_length=1, max_length=64)
    description: Optional[str] = None
    order_id: Optional[int] = Field(default=None, gt=0)
    order_item_ids: Optional[List[int]] = Field(default=None)


class LotUpdate(BaseModel):
    """
    Payload for partially updating a lot.
    """
    
    lot_date: Optional[date] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    description: Optional[str] = None
    order_id: Optional[int] = Field(default=None, gt=0)
    order_item_ids: Optional[List[int]] = None
