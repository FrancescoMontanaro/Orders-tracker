from jose import jwt
from typing import Any
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone

from .config import settings

# Create a password context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _create_token(sub: str, expires_delta: timedelta, scope: str) -> str:
    """
    Create a JWT token.

    Parameters:
        sub (str): The subject of the token.
        expires_delta (timedelta): The expiration time of the token.
        scope (str): The scope of the token.

    Returns:
        str: The encoded JWT token.
    """

    # Get the current time
    now = datetime.now(timezone.utc)

    # Create the JWT payload
    payload: dict[str, Any] = {
        "sub": sub,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
        "scope": scope,
    }

    # Encode the JWT token
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def hash_password(plain: str) -> str:
    """
    Hash a password.

    Parameters:
        plain (str): The plain text password to hash.

    Returns:
        str: The hashed password.
    """

    # Hash the password
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify a password against a hashed password.

    Parameters:
        plain (str): The plain text password to verify.
        hashed (str): The hashed password to verify against.

    Returns:
        bool: True if the password is valid, False otherwise.
    """

    # Verify the password
    return pwd_context.verify(plain, hashed)


def create_access_token(sub: str) -> str:
    """
    Create an access token.

    Parameters:
        sub (str): The subject of the token.

    Returns:
        str: The encoded JWT token.
    """

    # Create the access token
    return _create_token(sub, timedelta(minutes=settings.access_token_exp_minutes), "access_token")


def create_refresh_token(sub: str) -> str:
    """
    Create a refresh token.

    Parameters:
        sub (str): The subject of the token.

    Returns:
        str: The encoded JWT token.
    """

    # Create the refresh token
    return _create_token(sub, timedelta(days=settings.refresh_token_exp_days), "refresh_token")


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode a JWT token.

    Parameters:
        token (str): The encoded JWT token.

    Returns:
        dict[str, Any]: The decoded JWT payload.
    """

    # Decode the JWT token
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])