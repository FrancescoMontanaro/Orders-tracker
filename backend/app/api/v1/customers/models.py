from typing import Optional
from pydantic import BaseModel


class Customer(BaseModel):
    """
    Represents a customer in the system.
    """
    
    id: int
    name: str
    is_active: bool

    # Customer configuration
    class Config:
        from_attributes = True
        
        
class CustomerCreate(BaseModel):
    """
    Represents a request to create a new customer.
    """
    
    name: str


class CustomerUpdate(BaseModel):
    """
    Represents a request to update an existing customer.
    """
    
    name: Optional[str] = None
    is_active: Optional[bool] = None