from typing import AsyncGenerator
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from ..core.config import settings

# Create async database engine
engine = create_async_engine(settings.sqlalchemy_database_uri, pool_pre_ping=True)

# Create async session
async_session = async_sessionmaker(bind=engine, class_=AsyncSession, autoflush=False, autocommit=False)

# Create a database session
@asynccontextmanager
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Get a database session.

    Yields:
        AsyncSession: The database session.
    """

    # Get a database session
    async with async_session() as session:
        # Yield the session
        yield session