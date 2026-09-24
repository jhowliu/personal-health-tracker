"""A day's workout: what was prescribed for that date, and what actually happened."""

from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum

from app.domain.models import WorkoutTemplate


class ReplacementReason(StrEnum):
    EQUIPMENT_OCCUPIED = "equipment_occupied"
    KNEE_DISCOMFORT = "knee_discomfort"
    MISSING_EQUIPMENT = "missing_equipment"
    VARIETY = "variety"


class SetEffort(StrEnum):
    EASY = "easy"
    APPROPRIATE = "appropriate"
    HARD = "hard"


@dataclass(frozen=True, slots=True)
class DayWorkoutItem:
    """One exercise as prescribed for a single date — a copy, not a pointer.

    Copied from the template when the day is first opened, the same way a day's meals are
    copied from the meal library. Editing the template afterwards leaves this untouched,
    so what a past date says is what was actually planned for it.
    """

    id: str
    exercise_id: str
    exercise_name: str
    sort_order: int
    sets: int | None
    reps: str | None
    duration_sec: int | None
    weight_kg: float | None
    rest_sec: int
    note: str | None
    met: float | None
    # Set together when today's exercise was swapped out.
    replaced_exercise_name: str | None
    replacement_reason: ReplacementReason | None
    # The template item this was copied from, so "apply to template" knows where to write.
    source_item_id: str | None


@dataclass(frozen=True, slots=True)
class SetLog:
    day_workout_item_id: str
    exercise_id: str
    set_index: int
    reps_done: int | None
    duration_sec: int | None
    weight_kg: float | None
    effort: SetEffort | None
    done_at: datetime


@dataclass(frozen=True, slots=True)
class WorkoutExecutionItem:
    item: DayWorkoutItem
    logs: tuple[SetLog, ...]

    @property
    def completed_set_count(self) -> int:
        return len(self.logs)


@dataclass(frozen=True, slots=True)
class WorkoutExecution:
    date: date
    template: WorkoutTemplate | None
    items: tuple[WorkoutExecutionItem, ...]
    estimated_burn_kcal: int | None = None


@dataclass(frozen=True, slots=True)
class SetLogResult:
    next_weight_kg: float | None


def estimate_burn_kcal(execution: WorkoutExecution, weight_kg: float) -> int | None:
    """Rough kcal for a session: each logged exercise costs MET x weight x its own time.

    Display only. MET assumes steady effort and knows nothing about the load on the bar or
    how long the rests were, so two identical-looking sessions can differ by half. It must
    never reach compute_targets(): the profile's activity factor already prices training
    into TDEE, and spending it again would count one workout twice.

    Timed work carries its own minutes. Counted work does not, so those exercises share
    out the planned session length between them — which is why a 90-minute tennis match
    next to a 10-minute stretch no longer averages into one wrong number.

    Returns None when there is nothing honest to measure: no logged sets, or only custom
    exercises, which carry no MET.
    """
    performed = [entry for entry in execution.items if entry.logs and entry.item.met]
    if not performed:
        return None

    timed = [entry for entry in performed if _seconds_spent(entry)]
    counted = [entry for entry in performed if not _seconds_spent(entry)]
    total = sum(
        (entry.item.met or 0.0) * weight_kg * _seconds_spent(entry) / 3600 for entry in timed
    )

    planned_min = execution.template.duration_min if execution.template else None
    if counted and planned_min:
        # The plan's minutes cover every item, so counted work only claims its share.
        share = planned_min * 60 * (len(counted) / len(execution.items)) / len(counted)
        total += sum((entry.item.met or 0.0) * weight_kg * share / 3600 for entry in counted)

    return round(total) or None


def _seconds_spent(entry: WorkoutExecutionItem) -> float:
    """What was actually logged, falling back to what the item prescribed per set."""
    logged = sum(log.duration_sec or 0 for log in entry.logs)
    if logged:
        return float(logged)
    prescribed = entry.item.duration_sec
    return float(prescribed * len(entry.logs)) if prescribed else 0.0


def recommend_next_weight(weight_kg: float | None, effort: SetEffort | None) -> float | None:
    if weight_kg is None or effort is None:
        return None
    adjustment = {
        SetEffort.EASY: 2.5,
        SetEffort.APPROPRIATE: 0.0,
        SetEffort.HARD: -2.5,
    }[effort]
    return max(0.0, weight_kg + adjustment)
