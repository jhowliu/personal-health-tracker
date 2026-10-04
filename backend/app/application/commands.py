"""Typed inputs for the use cases that change some fields of something and leave the rest.

A field left as `UNSET` means "do not touch it". That is not the same as `None`, which is
a real value for fields like a reminder time (clear it) or a set's weight (unspecified).
"""

from dataclasses import dataclass, fields
from datetime import date
from enum import Enum
from typing import Any

from app.domain.models import ActivityLevel, Location, Sex, WorkoutTime
from app.domain.workout_execution import ReplacementReason, SetEffort


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
    # Seconds focus mode clocked in one session; added to what the day already has.
    trained_sec: int | None = None


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


@dataclass(frozen=True, slots=True)
class SetRecord:
    """One set as the user says it went, entered after the fact rather than as it happened."""

    reps_done: int | None
    duration_sec: int | None
    weight_kg: float | None
    effort: SetEffort | None
    speed_kmh: float | None = None
    incline_pct: float | None = None
