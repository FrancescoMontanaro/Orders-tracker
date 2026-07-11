from typing import Optional
from pydantic import BaseModel


class CustomerPreferences(BaseModel):
    """
    Represents the preferences of a customer.
    """

    id: int
    ddt_include_quantity: bool

    # Customer preferences configuration
    class Config:
        from_attributes = True


class CustomerPreferencesUpdate(BaseModel):
    """
    Represents a request to update customer preferences.
    """

    ddt_include_quantity: Optional[bool] = None


class Customer(BaseModel):
    """
    Represents a customer in the system.
    """

    id: int
    name: str
    is_active: bool
    preferences: Optional[CustomerPreferences] = None

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