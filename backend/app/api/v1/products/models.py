from typing import Optional
from pydantic import BaseModel

from ....db.orm.product import UnitEnum


class Product(BaseModel):
    """
    Represents a product in the system.
    """
    
    id: int
    name: str
    unit_price: float
    unit: UnitEnum
    is_active: bool

    # Define the Pydantic model configuration
    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    """
    Represents a request to create a new product.
    """
    
    name: str
    unit_price: float
    unit: UnitEnum


class ProductUpdate(BaseModel):
    """
    Represents a request to update an existing product.
    """

    name: Optional[str] = None
    unit_price: Optional[float] = None
    unit: Optional[UnitEnum] = None
    is_active: Optional[bool] = None