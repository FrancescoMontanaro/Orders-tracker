import asyncio
import logging
from fastapi import FastAPI
from contextlib import asynccontextmanager

from ..db import BaseORM, engine


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
async def lifespan(app: FastAPI):
    """
    Application lifespan event handler.
    """

    # Create database tables
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(BaseORM.metadata.create_all)

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
