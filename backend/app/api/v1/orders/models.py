from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel, Field

from .pricing import MAX_DISCOUNT, DiscountType, calculate_order_pricing


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
    net_amount: float = 0
    gross_amount: float = 0
    lot_id: Optional[int] = None
    lot_name: Optional[str] = None
    lot_date: Optional[date] = None
    lot_location: Optional[str] = None

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
    discount_type: DiscountType = "percentage"
    subtotal: float = 0
    discount_amount: float = 0
    status: str
    note: Optional[str] = None
    items: List[OrderItem] = []
    customer_name: Optional[str] = None

    # Pydantic config
    class Config:
        from_attributes = True

    # Properties
    @property
    def total_amount_with_discount(self) -> float:
        """
        Compute the total amount of the order, applying the discount.
        """

        pricing = calculate_order_pricing(
            lines = [(item.quantity, item.unit_price) for item in self.items],
            applied_discount = self.applied_discount,
            discount_type = self.discount_type,
        )
        return float(pricing.total)


class OrderItemCreate(BaseModel):
    """
    Payload for creating an order item.
    """
    
    product_id: int
    quantity: float = Field(gt=0)
    unit_price: Optional[float] = Field(default=None, gt=0)
    lot_id: Optional[int] = Field(default=None, gt=0)


class OrderCreate(BaseModel):
    """
    Payload for creating a new order with its items.
    """
    
    customer_id: int
    delivery_date: date
    applied_discount: float = Field(default=0, ge=0, le=MAX_DISCOUNT, allow_inf_nan=False, multiple_of=0.01)
    discount_type: DiscountType = "percentage"
    note: Optional[str] = None
    items: List[OrderItemCreate]


class OrderUpdateItem(BaseModel):
    """
    Optional update to an item (supports partial updates).
    """

    product_id: Optional[int] = None
    quantity: Optional[float] = Field(default=None, gt=0)
    lot_id: Optional[int] = Field(default=None, gt=0)


class OrderUpdate(BaseModel):
    """
    Partial update for an order (date and/or items).
    If items provided, they fully replace existing items.
    """

    delivery_date: Optional[date] = None
    items: Optional[List[OrderItemCreate]] = None
    customer_id: Optional[int] = None
    applied_discount: Optional[float] = Field(default=None, ge=0, le=MAX_DISCOUNT, allow_inf_nan=False, multiple_of=0.01)
    discount_type: Optional[DiscountType] = None
    status: Optional[str] = None
    note: Optional[str] = None
