"""Wires adapters into use cases. All wiring happens in this one file."""

from functools import lru_cache
from typing import Annotated

import aiosqlite
from fastapi import Depends, Header, HTTPException, status

from app.adapters.ai.jev import JevDecisionEngine
from app.adapters.ai.openai import OpenAIImageRecognizer
from app.adapters.auth.identities import OidcIdentityVerifier
from app.adapters.auth.passwords import Argon2Hasher
from app.adapters.auth.tokens import JwtTokenIssuer
from app.adapters.clock import SystemClock
from app.adapters.push.expo import ExpoPushSender
from app.adapters.sqlite.accounts import SqliteAccountStore
from app.adapters.sqlite.body import SqliteBodyStore
from app.adapters.sqlite.days import SqliteDayStore
from app.adapters.sqlite.foods import SqliteFoodStore
from app.adapters.sqlite.meal_photos import SqliteMealPhotoStore
from app.adapters.sqlite.meals import SqliteMealStore
from app.adapters.sqlite.reminders import SqliteReminderStore
from app.adapters.sqlite.training import SqliteTrainingStore
from app.adapters.sqlite.workout_execution import SqliteWorkoutExecutionStore
from app.adapters.storage.s3 import S3MealPhotoStorage
from app.application.accounts import AccountService
from app.application.body import BodyTrackingService
from app.application.daily_flow import DailyFlowService
from app.application.decisions import DecisionService
from app.application.foods import FoodCatalogService
from app.application.meal_photos import ExtrasService, MealPhotoService
from app.application.meals import MealService
from app.application.planning import DailyPlanService
from app.application.profiles import ProfileService
from app.application.reminders import ReminderService
from app.application.training import TrainingService
from app.application.workout_execution import WorkoutExecutionService
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


@lru_cache(maxsize=1)
def object_storage() -> S3MealPhotoStorage:
    return S3MealPhotoStorage(
        settings.s3_endpoint,
        settings.s3_region,
        settings.s3_bucket,
        settings.s3_access_key,
        settings.s3_secret_key,
        settings.s3_public_endpoint or None,
    )


@lru_cache(maxsize=1)
def decision_engine() -> JevDecisionEngine:
    return JevDecisionEngine(settings.jev_api_key, settings.jev_model)


@lru_cache(maxsize=1)
def image_recognizer() -> OpenAIImageRecognizer:
    return OpenAIImageRecognizer(settings.openai_api_key, settings.openai_model)


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
    return TrainingService(SqliteTrainingStore(conn), decisions(conn))


def daily_flow(conn: DbConn) -> DailyFlowService:
    return DailyFlowService(SqliteDayStore(conn), SqliteAccountStore(conn), clock())


def workout_execution(conn: DbConn) -> WorkoutExecutionService:
    return WorkoutExecutionService(
        SqliteWorkoutExecutionStore(conn), SqliteAccountStore(conn), clock()
    )


def reminders(conn: DbConn) -> ReminderService:
    return ReminderService(SqliteReminderStore(conn), push_sender(), clock())


def foods(conn: DbConn) -> FoodCatalogService:
    return FoodCatalogService(SqliteFoodStore(conn))


def meals(conn: DbConn) -> MealService:
    return MealService(SqliteMealStore(conn), SqliteFoodStore(conn))


def daily_plan(conn: DbConn) -> DailyPlanService:
    return DailyPlanService(
        SqliteDayStore(conn),
        SqliteMealStore(conn),
        SqliteFoodStore(conn),
        SqliteAccountStore(conn),
        clock(),
        SqliteMealPhotoStore(conn),
    )


def meal_photos(conn: DbConn) -> MealPhotoService:
    return MealPhotoService(
        SqliteMealPhotoStore(conn),
        object_storage(),
        image_recognizer(),
        SqliteFoodStore(conn),
        decisions(conn),
        clock(),
        settings.daily_ai_image_quota,
    )


def extras(conn: DbConn) -> ExtrasService:
    return ExtrasService(
        SqliteDayStore(conn),
        SqliteFoodStore(conn),
        SqliteMealPhotoStore(conn),
        SqliteAccountStore(conn),
    )


def decisions(conn: DbConn) -> DecisionService:
    return DecisionService(decision_engine(), SqliteFoodStore(conn), SqliteTrainingStore(conn))


Accounts = Annotated[AccountService, Depends(accounts)]
Profiles = Annotated[ProfileService, Depends(profiles)]
BodyTracking = Annotated[BodyTrackingService, Depends(body_tracking)]
Training = Annotated[TrainingService, Depends(training)]
DailyFlow = Annotated[DailyFlowService, Depends(daily_flow)]
WorkoutExecution = Annotated[WorkoutExecutionService, Depends(workout_execution)]
Reminders = Annotated[ReminderService, Depends(reminders)]
Foods = Annotated[FoodCatalogService, Depends(foods)]
Meals = Annotated[MealService, Depends(meals)]
DailyPlan = Annotated[DailyPlanService, Depends(daily_plan)]
MealPhotos = Annotated[MealPhotoService, Depends(meal_photos)]
Extras = Annotated[ExtrasService, Depends(extras)]
Decisions = Annotated[DecisionService, Depends(decisions)]
