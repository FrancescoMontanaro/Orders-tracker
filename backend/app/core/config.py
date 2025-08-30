import json
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Database settings for the application.
    """

    # Database connection settings
    db_user: str
    db_password: str
    db_host: str
    db_port: int
    db_name: str

    # Security settings
    secret_key: str
    registration_password_hash: str
    jwt_algorithm: str = "HS256"
    access_token_exp_minutes: int = 15
    refresh_token_exp_days: int = 7
    
    # Cookies helper
    refresh_cookie_name: str = "refresh_token"
    refresh_cookie_path: str = "/api/auth/refresh"
    refresh_cookie_max_age: int = refresh_token_exp_days * 24 * 60 * 60
    refresh_cookie_samesite: str = "lax"
    refresh_cookie_domain: str | None = None
    refresh_cookie_secure: bool = False

    # CORS settings
    cors_origins: list[str] = Field(alias="CORS_ORIGINS")

    # Load environment variables from .env file
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # CORS settings
    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v):
        if isinstance(v, str):
            # Try JSON
            try:
                return json.loads(v)
            except Exception:
                # Fallback: CSV
                return [s.strip() for s in v.split(",") if s.strip()]
        return v

    @property
    def sqlalchemy_database_uri(self) -> str:
        return (
            f"mysql+aiomysql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"
        )

# Initialize settings
settings = Settings() # type: ignore