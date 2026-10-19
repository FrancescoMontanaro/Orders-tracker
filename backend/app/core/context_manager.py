import asyncio
import logging
from fastapi import FastAPI
from sqlalchemy import text
from typing import AsyncGenerator
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncConnection

from ..db import BaseORM, engine


async def _ensure_users_role_column(conn: AsyncConnection) -> None:
    """
    Add the `users.role` column when it is missing.

    `metadata.create_all` only creates missing tables, it never alters existing
    ones: on a database created before roles existed the column would never
    appear. This check is idempotent, so it is safe to run at every startup.

    Parameters:
        conn (AsyncConnection): The connection used to inspect and alter the schema.
    """

    # Look for the column in the schema of the database we are connected to
    exists = await conn.scalar(
        text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'role'"
        )
    )

    # Nothing to do when the column is already there
    if exists:
        return

    # Add the column defaulting every pre-existing user to 'admin', preserving the previous behaviour
    await conn.execute(
        text("ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'admin'")
    )

    # Log the applied migration
    logging.info("Added missing column users.role (default 'admin')")


async def _stale_jobs_watchdog() -> None:
    """
    Background loop that periodically marks timed-out export jobs as failed.
    Runs every 60 seconds for the entire application lifetime.
    """

    # Import here to avoid circular imports at module load time
    from .config import settings
    from ..api.v1.export.service import expire_stale_export_jobs

    while True:
        # Wait before the first check as well, giving the app time to start up
        await asyncio.sleep(60)

        try:
            # Expire stale export jobs that have been running for too long
            await expire_stale_export_jobs(settings.export_job_timeout_seconds)
        
        except Exception:
            # Log the exception but keep the watchdog running - we don't want a transient error to stop it permanently
            logging.exception("Error in stale jobs watchdog")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan event handler.
    """

    # Create database tables
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(BaseORM.metadata.create_all)

        # Patch tables created before the roles feature existed
        await _ensure_users_role_column(conn)

    # Start the background watchdog that expires stale export jobs
    watchdog_task = asyncio.create_task(_stale_jobs_watchdog())

    # Yield control back to the application
    yield

    # Cancel the watchdog task on shutdown
    watchdog_task.cancel()

    try:
        # Wait for the watchdog task to finish
        await watchdog_task

    except asyncio.CancelledError:
        # Expected on shutdown, no action needed
        pass
