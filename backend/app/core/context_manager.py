from fastapi import FastAPI
from contextlib import asynccontextmanager

from ..db import BaseORM, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan event handler.
    """

    # Create database tables
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(BaseORM.metadata.create_all)

    # Yield control back to the application
    yield
