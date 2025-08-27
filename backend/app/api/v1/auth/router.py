import hashlib
from typing import Optional
from sqlalchemy import select
from pydantic import EmailStr
from hmac import compare_digest
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import APIRouter, Response, HTTPException, status, Depends, Form, Cookie

from .models import AccessToken
from ....db.orm.user import UserORM
from ....core.config import settings
from ....db.session import db_session
from ....core.response_models import SuccessResponse
from ....core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token


# Create a router for authentication
router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    path = "/register", 
    status_code = status.HTTP_201_CREATED,
    response_model = SuccessResponse[None]
)
async def register(
    username: EmailStr = Form(...),
    password: str = Form(...),
    name: str = Form(...),
    registration_password: str = Form(..., description="Secret per abilitare la registrazione")
) -> SuccessResponse:
    """
    User registration

    Parameters:
    - username (EmailStr): The email address of the user
    - password (str): The password of the user
    - name (str): The name of the user
    - registration_password (str): The registration password to authorize the registration

    Returns:
    - SuccessResponse: The response containing the result of the registration
    """

    # Compute SHA-256 hash of the input
    provided_hash = hashlib.sha256(registration_password.encode()).hexdigest()

    # Compare with the expected hash from environment variables
    if not compare_digest(provided_hash, settings.registration_password_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registrazione non autorizzata")
    
    # Open a new database session
    async with db_session() as session:
        # Check if the user already exists
        exists = await session.scalar(select(UserORM).where(UserORM.email == username))

        # If the user already exists, raise an error
        if exists:
            # If the user already exists, raise an error
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email già registrata")

        # Create a new user
        user = UserORM(email=username, name=name, password_hash=hash_password(password))

        # Add the user to the session
        session.add(user)

        # Commit the session
        await session.commit()

    # Return a success response
    return SuccessResponse()


@router.post(
    path = "/login", 
    response_model = AccessToken
)
async def login(response: Response, form: OAuth2PasswordRequestForm = Depends()) -> AccessToken:
    """
    User login

    Parameters:
    - form (OAuth2PasswordRequestForm): The login form containing email and password

    Returns:
    - AccessToken: The response containing the access and refresh tokens
    """

    # Open a new database session
    async with db_session() as session:
        # Retrieve the user from the database
        user = await session.scalar(select(UserORM).where(UserORM.email == form.username))

        # Verify the user's password
        if not user or not verify_password(form.password, user.password_hash):
            # If the user is not found or the password is incorrect, raise an error
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenziali non valide")

    # Create the tokens
    access_token = create_access_token(sub=user.email)
    refresh_token = create_refresh_token(sub=user.email)

    # set cookie httpOnly with the refresh token
    response.set_cookie(
        key = settings.refresh_cookie_name,
        value = refresh_token,
        httponly = True,
        samesite = settings.refresh_cookie_samesite, # type: ignore
        secure = settings.refresh_cookie_secure,
        path = settings.refresh_cookie_path,
        max_age = settings.refresh_cookie_max_age
    )

    # Set the response body with the access token
    return AccessToken(access_token=access_token)


@router.post(
    path = "/refresh", 
    response_model = AccessToken
)
async def refresh(response: Response, refresh_token: Optional[str] = Cookie(None)) -> AccessToken:
    """
    Refresh the access token using the refresh token

    Parameters:
    - refresh_token (str): The refresh token

    Returns:
    - AccessToken: The response containing the new access token
    """

    # If the refresh token is not provided, raise an error
    if not refresh_token:
        # If the refresh token is not provided, raise an error
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token mancante")

    try:
        # Decode the refresh token
        payload = decode_token(refresh_token)

        # Verify the token's scope
        if payload.get("scope") != "refresh_token":
            # If the scope is invalid, raise an error
            raise ValueError("Invalid scope")

        # Get the email from the token's payload
        email = payload["sub"]
        
    except Exception:
        # If the refresh token is invalid, raise an error
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token non valido")

    # Generate new tokens
    new_access = create_access_token(sub=email)
    new_refresh = create_refresh_token(sub=email)

    # Set the new refresh token cookie
    response.set_cookie(
        key = settings.refresh_cookie_name,
        value = new_refresh,
        httponly = True,
        samesite = settings.refresh_cookie_samesite,  # type: ignore
        secure = settings.refresh_cookie_secure,
        path = settings.refresh_cookie_path,
        max_age = settings.refresh_cookie_max_age,
    )

    # Return the new access token
    return AccessToken(access_token=new_access)
    
    
@router.post(
    path = "/logout", 
    response_model = SuccessResponse[None]
)
async def logout(response: Response) -> SuccessResponse:
    """
    User logout

    Parameters:
    - response (Response): The response object

    Returns:
    - SuccessResponse: The response containing the result of the logout
    """

    # Delete the refresh token cookie
    response.delete_cookie(
        key = settings.refresh_cookie_name,
        path = settings.refresh_cookie_path,
    )

    # Return a success response
    return SuccessResponse()