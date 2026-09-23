from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import domain_error_handler
from app.api.routes import auth, body_logs, days, devices, training, users
from app.config import settings
from app.db import verify_schema
from app.domain.errors import DomainError
from app.scheduler import scheduler


@asynccontextmanager
async def lifespan(_: FastAPI):
    await verify_schema()
    scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


app = FastAPI(title="每日減脂計畫 API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(DomainError, domain_error_handler)


@app.get("/healthz", tags=["ops"])
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


for router in (auth, users, body_logs, days, training, devices):
    app.include_router(router.router)
