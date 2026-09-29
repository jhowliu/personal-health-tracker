"""Typed inputs for the use cases that change some fields of something and leave the rest.

A field left as `UNSET` means "do not touch it". That is not the same as `None`, which is
a real value for fields like a reminder time (clear it) or a set's weight (unspecified).
"""

from dataclasses import dataclass, fields
from datetime import date
from enum import Enum
from typing import Any

from app.domain.models import ActivityLevel, Location, Sex, WorkoutTime
from app.domain.workout_execution import ReplacementReason


class _Unset(Enum):
    UNSET = "unset"


UNSET = _Unset.UNSET

type Patch[T] = T | _Unset


def applied(command: object) -> dict[str, Any]:
    """The fields of a command that were actually given."""
    return {
        field.name: value
        for field in fields(command)  # type: ignore[arg-type]
        if (value := getattr(command, field.name)) is not UNSET
    }


@dataclass(frozen=True, slots=True)
class ProfileChange:
    sex: Patch[Sex] = UNSET
    birth_date: Patch[date] = UNSET
    height_cm: Patch[float] = UNSET
    weight_kg: Patch[float] = UNSET
    activity_level: Patch[ActivityLevel] = UNSET
    deficit_pct: Patch[int] = UNSET
    auto_scale_carbs: Patch[bool] = UNSET
    auto_assign_meals: Patch[bool] = UNSET
    workout_time: Patch[WorkoutTime] = UNSET
    default_location: Patch[Location] = UNSET
    reminder_time: Patch[str | None] = UNSET
    timezone: Patch[str] = UNSET


@dataclass(frozen=True, slots=True)
class DayAdjustment:
    """What the user changed about a Day. `None` and `False` mean "not part of this change"."""

    workout_time: WorkoutTime | None = None
    workout_done: bool = False
    workout_skipped: bool = False


@dataclass(frozen=True, slots=True)
class WorkoutItemChange:
    """Edits to one exercise on a Day's workout. Naming another exercise replaces it."""

    exercise_id: str | None = None
    replacement_reason: ReplacementReason | None = None
    sets: Patch[int | None] = UNSET
    reps: Patch[str | None] = UNSET
    duration_sec: Patch[int | None] = UNSET
    weight_kg: Patch[float | None] = UNSET
    rest_sec: Patch[int | None] = UNSET
    note: Patch[str | None] = UNSET
