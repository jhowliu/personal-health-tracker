"""Progress over time for 進度: how each day of a month went, and a week in a few numbers.

The numbers are only sums and averages. Whether the eating or training was good is left to the
AI review, which reads the week's detail.
"""

from collections.abc import Iterable, Mapping
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
    # Opened in the app, so it has meal slots and a workout; a weigh-in alone does not open one.
    opened: bool = True


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


@dataclass(frozen=True, slots=True)
class WeekSummary:
    """One line in the list of past weekly reports."""

    start: date  # Monday
    end: date  # Sunday
    days_complete: int
    workouts: int


@dataclass(frozen=True, slots=True)
class WeekVolume:
    """One bar of the training-volume chart."""

    start: date  # Monday
    volume_kg: float


def logged(day: DayActivity) -> bool:
    """Whether the user recorded anything that day; opening the app alone creates a day."""
    return day.record.body_logged or day.record.meals_resolved > 0 or day.workout is not None


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


def past_weeks(
    activity: Iterable[DayActivity], this_week: date, shown: Iterable[date]
) -> tuple[WeekSummary, ...]:
    """Weeks with anything logged, newest first: every week before `this_week`, and this week
    too once it is in `shown`, its report due or already seen."""
    shown = set(shown)
    weeks: dict[date, list[DayActivity]] = {}
    for day in activity:
        if logged(day):
            weeks.setdefault(week_bounds(day.record.date)[0], []).append(day)
    return tuple(
        WeekSummary(
            start=start,
            end=start + timedelta(days=6),
            days_complete=sum(1 for day in days if day.record.complete),
            workouts=sum(1 for day in days if day.workout is WorkoutMark.DONE),
        )
        for start, days in sorted(weeks.items(), reverse=True)
        if start < this_week or start in shown
    )


def weekly_volumes(
    daily: Mapping[date, float], this_week: date, weeks: int
) -> tuple[WeekVolume, ...]:
    """The `weeks` weeks up to and including `this_week`, oldest first. A week without a loaded
    set is 0, so a gap in training shows as a gap."""
    totals: dict[date, float] = {}
    for day, volume in daily.items():
        start = week_bounds(day)[0]
        totals[start] = totals.get(start, 0) + volume
    return tuple(
        WeekVolume(start, round(totals.get(start, 0), 1))
        for start in (this_week - timedelta(weeks=back) for back in range(weeks - 1, -1, -1))
    )
