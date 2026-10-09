"""Progress over time for 進度: how each day of a month went, and a week in a few numbers.

The numbers are only sums and averages. Whether the eating or training was good is left to the
AI review, which reads the week's detail.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta
from enum import StrEnum

from app.domain.models import BodyLog
from app.domain.streak import DayRecord


class DayMark(StrEnum):
    # Weighed in and every planned meal eaten or skipped: a day the streak counts.
    COMPLETE = "complete"
    # Anything less, logged or not.
    EMPTY = "empty"


class WorkoutMark(StrEnum):
    DONE = "done"
    SKIPPED = "skipped"


@dataclass(frozen=True, slots=True)
class DayActivity:
    """What a store knows of one day: the streak's record and how the workout ended."""

    record: DayRecord
    workout: WorkoutMark | None


@dataclass(frozen=True, slots=True)
class CalendarDay:
    date: date
    mark: DayMark
    workout: WorkoutMark | None


@dataclass(frozen=True, slots=True)
class CalendarMonth:
    month: date  # the first of the month
    today: date
    days: tuple[CalendarDay, ...]


def mark_of(record: DayRecord) -> DayMark:
    return DayMark.COMPLETE if record.complete else DayMark.EMPTY


@dataclass(frozen=True, slots=True)
class WeeklyReview:
    start: date  # Monday
    end: date  # Sunday
    weight_average: float | None
    weight_change: float | None  # against the week before's average
    waist_latest: float | None
    waist_change: float | None  # against the latest waist before the week
    days_complete: int
    workouts: int
    volume_kg: float  # weight × reps over every set with a load
    previous_volume_kg: float


def week_bounds(day: date) -> tuple[date, date]:
    """The Monday-to-Sunday week `day` falls in."""
    monday = day - timedelta(days=day.weekday())
    return monday, monday + timedelta(days=6)


def _average_weight(logs: Iterable[BodyLog]) -> float | None:
    weights = [log.weight_kg for log in logs if log.weight_kg is not None]
    return round(sum(weights) / len(weights), 1) if weights else None


def _latest_waist(logs: Iterable[BodyLog]) -> float | None:
    waists = [log.waist_cm for log in logs if log.waist_cm is not None]
    return waists[-1] if waists else None


def _change(now: float | None, before: float | None) -> float | None:
    return round(now - before, 1) if now is not None and before is not None else None


def weekly_review(
    start: date,
    activity: Iterable[DayActivity],
    logs: Iterable[BodyLog],
    volume_kg: float,
    previous_volume_kg: float,
) -> WeeklyReview:
    """The week from `start`. `logs` runs oldest first and reaches back past the week before,
    so the waist has something earlier to compare with."""
    end = start + timedelta(days=6)
    logs = tuple(logs)
    week = [log for log in logs if start <= log.date <= end]
    before = [log for log in logs if log.date < start]
    week_before = [log for log in before if log.date >= start - timedelta(days=7)]
    activity = tuple(activity)
    weight = _average_weight(week)
    waist = _latest_waist(week)
    return WeeklyReview(
        start=start,
        end=end,
        weight_average=weight,
        weight_change=_change(weight, _average_weight(week_before)),
        waist_latest=waist,
        waist_change=_change(waist, _latest_waist(before)),
        days_complete=sum(1 for day in activity if day.record.complete),
        workouts=sum(1 for day in activity if day.workout is WorkoutMark.DONE),
        volume_kg=round(volume_kg, 1),
        previous_volume_kg=round(previous_volume_kg, 1),
    )
