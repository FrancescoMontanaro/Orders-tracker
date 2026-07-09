FROM python:3.11-slim AS base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget netcat-traditional \
  && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.11.28 /uv /usr/local/bin/uv

# Install Python dependencies
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-install-project --no-dev
ENV PATH="/app/.venv/bin:$PATH"

# Copy the source code
COPY app ./app

# Expose the application port
EXPOSE 8000

# Launch the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]