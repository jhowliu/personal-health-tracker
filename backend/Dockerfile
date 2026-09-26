FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

COPY app ./app
COPY migrations ./migrations
COPY seeds ./seeds
COPY scripts ./scripts

RUN mkdir -p /data

EXPOSE 8000

CMD ["sh", "-c", "python -m scripts.migrate && python -m seeds.foods && python -m seeds.exercises && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1"]
