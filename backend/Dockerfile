FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# deps di sistema minime (aggiungi build-essential se ti serve compilare pacchetti)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget netcat-traditional \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# avvio con gunicorn + uvicorn workers
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]