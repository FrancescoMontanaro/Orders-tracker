from sqlalchemy import select
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, Query, WebSocketException, status

from ..db.orm.user import UserORM
from ..db.session import db_session
from ..core.security import decode_token


# Create OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserORM:
    """
    Get the current user from the token.

    Parameters:
        token (str): The access token.

    Returns:
        UserORM: The current user.
    """
    
    try:
        # Decode the token
        payload = decode_token(token)

        # Check the token scope
        if payload.get("scope") != "access_token":
            # Raise an error if the scope is invalid
            raise ValueError("Invalid scope")

        # Get the email from the token
        email = payload.get("sub")
        
    except Exception:
        # Handle token decoding errors
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Get the user from the database
    async with db_session() as session:
        # Query the user by email
        user = await session.scalar(select(UserORM).where(UserORM.email == email))

        # Check if the user exists and is active
        if not user or not user.is_active:
            # Raise an error if the user is inactive or missing
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing user")

        # Return the user
        return user


async def get_ws_user(
    token: str = Query(..., description="JWT access token"),
) -> UserORM:
    """
    FastAPI dependency for WebSocket endpoints.

    Validates the JWT passed as a query parameter (browsers cannot send
    custom headers on WebSocket connections) and returns the active user.
    Raises WebSocketException(code=4001) on any auth failure so FastAPI
    closes the connection before accepting it.
    """

    try:
        # Decode the token and validate its scope
        payload = decode_token(token)

        # Ensure the token has the correct scope for access tokens
        if payload.get("scope") != "access_token":
            raise ValueError("Invalid scope")
        
        # Extract the email (subject) from the token payload
        email = payload.get("sub")

        # Ensure the email is present in the token
        if not email:
            raise ValueError("Missing subject")
        
    except Exception:
        # On any error (e.g. token decoding, validation), raise a WebSocketException to reject the connection
        raise WebSocketException(code=4001)

    # Retrieve the user from the database using the email from the token
    async with db_session() as session:
        # Query the user by email
        user = await session.scalar(select(UserORM).where(UserORM.email == email))

    # Check if the user exists and is active; if not, raise a WebSocketException to reject the connection
    if not user or not user.is_active:
        # Raise a WebSocketException if the user is inactive or does not exist
        raise WebSocketException(code=4001)

    # If everything is valid, return the user object for use in the WebSocket endpoint
    return user


def require_active_user(user: UserORM = Depends(get_current_user)) -> UserORM:
    """
    Require an active user.

    Parameters:
        user (UserORM): The current user.

    Returns:
        UserORM: The current user.
    """

    # Return the authenticated user
    return user