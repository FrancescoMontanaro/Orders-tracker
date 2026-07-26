from pydantic import BaseModel


class AccessToken(BaseModel):
    """
    Token model for authentication.
    """

    access_token: str
    token_type: str = "bearer"


class CurrentUser(BaseModel):
    """
    The authenticated user as exposed to the client.
    Never includes the password hash.
    """

    id: int
    email: str
    name: str
    role: str
    is_active: bool

    # Pydantic config
    class Config:
        from_attributes = True
