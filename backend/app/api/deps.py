"""Wires adapters into use cases. All wiring happens in this one file."""

from functools import lru_cache
from typing import Annotated

import aiosqlite
from fastapi import Depends, Header, HTTPException, status

from app.adapters.auth.identities import OidcIdentityVerifier
from app.adapters.auth.passwords import Argon2Hasher
from app.adapters.auth.tokens import JwtTokenIssuer
from app.adapters.clock import SystemClock
from app.adapters.push.expo import ExpoPushSender
from app.adapters.sqlite.accounts import SqliteAccountStore
from app.adapters.sqlite.body import SqliteBodyStore
from app.adapters.sqlite.days import SqliteDayStore
from app.adapters.sqlite.reminders import SqliteReminderStore
from app.adapters.sqlite.training import SqliteTrainingStore
from app.application.accounts import AccountService
from app.application.body import BodyTrackingService
from app.application.daily_flow import DailyFlowService
from app.application.profiles import ProfileService
from app.application.reminders import ReminderService
from app.application.training import TrainingService
from app.config import settings
from app.db import db_dep


@lru_cache(maxsize=1)
def clock() -> SystemClock:
    return SystemClock()


@lru_cache(maxsize=1)
def hasher() -> Argon2Hasher:
    return Argon2Hasher()


@lru_cache(maxsize=1)
def token_issuer() -> JwtTokenIssuer:
    return JwtTokenIssuer(
        settings.jwt_secret, settings.jwt_access_ttl_min, settings.jwt_refresh_ttl_days
    )


@lru_cache(maxsize=1)
def identity_verifier() -> OidcIdentityVerifier:
    return OidcIdentityVerifier(
        google_audiences=(
            settings.google_client_id_ios,
            settings.google_client_id_android,
            settings.google_client_id_web,
        ),
        apple_audience=settings.apple_client_id,
    )


@lru_cache(maxsize=1)
def push_sender() -> ExpoPushSender:
    return ExpoPushSender(settings.expo_access_token)


DbConn = Annotated[aiosqlite.Connection, Depends(db_dep)]


async def current_user_id(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "缺少存取權杖")
    try:
        payload = token_issuer().decode_access(authorization.split(" ", 1)[1])
    except Exception as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "存取權杖無效") from e
    if not (sub := payload.get("sub")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "存取權杖無效")
    return sub


CurrentUserId = Annotated[str, Depends(current_user_id)]


def accounts(conn: DbConn) -> AccountService:
    return AccountService(
        SqliteAccountStore(conn), hasher(), token_issuer(), identity_verifier(), clock()
    )


def profiles(conn: DbConn) -> ProfileService:
    return ProfileService(SqliteAccountStore(conn), clock())


def body_tracking(conn: DbConn) -> BodyTrackingService:
    return BodyTrackingService(SqliteBodyStore(conn), clock())


def training(conn: DbConn) -> TrainingService:
    return TrainingService(SqliteTrainingStore(conn))


def daily_flow(conn: DbConn) -> DailyFlowService:
    return DailyFlowService(SqliteDayStore(conn), SqliteAccountStore(conn), clock())


def reminders(conn: DbConn) -> ReminderService:
    return ReminderService(SqliteReminderStore(conn), push_sender(), clock())


Accounts = Annotated[AccountService, Depends(accounts)]
Profiles = Annotated[ProfileService, Depends(profiles)]
BodyTracking = Annotated[BodyTrackingService, Depends(body_tracking)]
Training = Annotated[TrainingService, Depends(training)]
DailyFlow = Annotated[DailyFlowService, Depends(daily_flow)]
Reminders = Annotated[ReminderService, Depends(reminders)]
