from datetime import date
from typing import List
from pydantic import BaseModel


class DeliveryItem(BaseModel):
    """
    A single product line to prepare.
    Quantities only: no prices, no economic data.
    """

    product_id: int
    product_name: str
    unit: str
    quantity: float


class DeliveryOrder(BaseModel):
    """
    The products of one order to be delivered.
    The customer is intentionally not exposed: orders are identified by their id only.
    """

    order_id: int
    status: str
    items: List[DeliveryItem] = []


class DailyDeliveries(BaseModel):
    """
    The whole picture for a delivery day: the products to prepare grouped by
    order, plus the per-product totals across every order of the day.
    """

    delivery_date: date
    orders: List[DeliveryOrder] = []
    totals: List[DeliveryItem] = []
