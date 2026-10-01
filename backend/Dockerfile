FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

# pyproject declares packages = ["app"], so app/ must be present before installing.
COPY pyproject.toml ./
COPY app ./app
RUN pip install --upgrade pip && pip install .

COPY migrations ./migrations
COPY seeds ./seeds
COPY scripts ./scripts

RUN mkdir -p /data

EXPOSE 8000

# HOST/PORT are overridable so the VPS can run on the host network behind its own Caddy.
CMD ["sh", "-c", "python -m scripts.migrate && python -m seeds.foods && python -m seeds.exercises && python -m seeds.workout_templates && uvicorn app.main:app --host ${HOST:-0.0.0.0} --port ${PORT:-8000} --workers 1"]
