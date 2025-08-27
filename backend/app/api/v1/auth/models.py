from pydantic import BaseModel


class AccessToken(BaseModel):
    """
    Token model for authentication.
    """
    
    access_token: str
    token_type: str = "bearer"