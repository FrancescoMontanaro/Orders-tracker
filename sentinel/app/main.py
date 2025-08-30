import os
import time
from fastapi import FastAPI, Response, status

app = FastAPI(title="Backup Sentinel", version="1.1.0")

THRESHOLD = int(os.getenv("SENTINEL_THRESHOLD_SECONDS", str(26 * 3600))) # max allowed age for heartbeat
HEARTBEAT = os.getenv("SENTINEL_HEARTBEAT_PATH", "/status/last_ok")

# Grace period from container boot to allow the app while waiting for the first successful backup.
BOOT_GRACE = int(os.getenv("SENTINEL_BOOT_GRACE_SECONDS", str(24 * 3600)))  # default 24h
BOOT_TIME = time.time()

def heartbeat_age_seconds() -> float | None:
    """Return heartbeat age in seconds, or None if the file is missing."""
    try:
        mtime = os.path.getmtime(HEARTBEAT)
        return time.time() - mtime
    except FileNotFoundError:
        return None

@app.get("/ok")
def ok():
    """
    200 OK if:
      - heartbeat exists and is fresh (<= THRESHOLD), or
      - heartbeat missing but still within BOOT_GRACE window (BOOT_GRACE).
    Otherwise -> 503 Service Unavailable.
    """
    age = heartbeat_age_seconds()
    if age is None:
        # Heartbeat missing
        since_boot = time.time() - BOOT_TIME
        if since_boot <= BOOT_GRACE:
            return Response(content=f"BOOT_GRACE (since_boot={int(since_boot)}s)\n", status_code=status.HTTP_200_OK)
        return Response(content="MISSING\n", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)

    # Heartbeat present: validate freshness
    if age <= THRESHOLD:
        return Response(content="OK\n", status_code=status.HTTP_200_OK)
    return Response(content=f"STALE ({int(age)}s)\n", status_code=status.HTTP_503_SERVICE_UNAVAILABLE)

@app.get("/health")
def health():
    return {"status": "up"}