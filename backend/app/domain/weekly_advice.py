"""The AI's review of a week: what it is shown, and what it writes back: a look back at the
week, then one thing to do next week for eating, training and the body.

The digest carries what the user logged day by day, next to the day's targets, so the model
can say which days and meals fell short. It judges; the numbers are worked out here.
"""

from dataclasses import dataclass
from datetime import date
from typing import Literal

from app.domain.models import ActivityLevel, MealSlot, MealTime, Nutrients, Sex, Targets
from app.domain.progress import WeeklyReview, WorkoutMark
from app.domain.workout_execution import WorkoutExecutionItem


@dataclass(frozen=True, slots=True)
class MealDigest:
    meal_time: MealTime
    state: Literal["eaten", "skipped", "open"]
    nutrients: Nutrients


@dataclass(frozen=True, slots=True)
class ExerciseDigest:
    name: str
    sets: int
    reps: int
    top_weight_kg: float | None
    minutes: int


@dataclass(frozen=True, slots=True)
class DayDigest:
    date: date
    weight_kg: float | None
    waist_cm: float | None
    # None on a day never opened in the app: nothing was planned or eaten there.
    targets: Targets | None
    eaten: Nutrients | None
    meals: tuple[MealDigest, ...]
    workout: WorkoutMark | None
    exercises: tuple[ExerciseDigest, ...]


@dataclass(frozen=True, slots=True)
class WeekDigest:
    review: WeeklyReview
    sex: Sex
    age: int
    height_cm: float
    activity_level: ActivityLevel
    deficit_pct: int
    days: tuple[DayDigest, ...]


@dataclass(frozen=True, slots=True)
class WeeklyAdvice:
    # How the week went, in a sentence or two.
    summary: str
    # What to do next week.
    diet: str
    training: str
    body: str


def meal_digest(slot: MealSlot) -> MealDigest | None:
    """A planned meal as eaten, skipped or left open; extras only when something was added."""
    if slot.meal_time is MealTime.EXTRAS:
        return MealDigest(slot.meal_time, "eaten", slot.nutrients) if slot.nutrients.kcal else None
    state = "eaten" if slot.eaten_at else "skipped" if slot.skipped_at else "open"
    return MealDigest(slot.meal_time, state, slot.nutrients)


def exercise_digest(entry: WorkoutExecutionItem) -> ExerciseDigest | None:
    """What was done of one exercise, or None when no set was logged."""
    if not entry.logs:
        return None
    weights = [log.weight_kg for log in entry.logs if log.weight_kg is not None]
    return ExerciseDigest(
        name=entry.item.exercise_name,
        sets=len(entry.logs),
        reps=sum(log.reps_done or 0 for log in entry.logs),
        top_weight_kg=max(weights) if weights else None,
        minutes=round(sum(log.duration_sec or 0 for log in entry.logs) / 60),
    )
