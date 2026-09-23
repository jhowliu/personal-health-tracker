"""SQLite 的 TEXT 欄位與 domain 型別之間的轉換。"""

from datetime import UTC, date, datetime

import aiosqlite

from app.domain.models import (
    ActivityLevel,
    Location,
    Profile,
    Sex,
    WorkoutTime,
)

ISO_MS = "%Y-%m-%dT%H:%M:%S.%fZ"


def to_iso(value: datetime) -> str:
    return value.astimezone(UTC).strftime(ISO_MS)[:-4] + "Z"


def from_iso(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def to_day(value: date) -> str:
    return value.isoformat()


def from_day(value: str) -> date:
    return date.fromisoformat(value)


def to_profile(row: aiosqlite.Row) -> Profile:
    return Profile(
        user_id=row["user_id"],
        sex=Sex(row["sex"]),
        birth_date=from_day(row["birth_date"]),
        height_cm=row["height_cm"],
        weight_kg=row["weight_kg"],
        activity_level=ActivityLevel(row["activity_level"]),
        deficit_pct=row["deficit_pct"],
        carb_base_g=row["carb_base_g"],
        auto_scale_carbs=bool(row["auto_scale_carbs"]),
        auto_assign_meals=bool(row["auto_assign_meals"]),
        workout_time=WorkoutTime(row["workout_time"]),
        default_location=Location(row["default_location"]),
        reminder_time=row["reminder_time"],
        timezone=row["timezone"],
    )
