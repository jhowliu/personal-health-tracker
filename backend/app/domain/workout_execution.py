"""A day's workout: what was prescribed for that date, and what actually happened."""

from collections.abc import Callable
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
    # From the exercise, so focus mode can tell bodyweight work from a lift whose weight the
    # plan simply left blank (the built-in templates set none).
    equipment: str | None = None


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
class PastSet:
    """A set from an earlier day: where the next session of that exercise starts from."""

    date: date
    weight_kg: float | None
    reps_done: int | None
    duration_sec: int | None
    effort: SetEffort | None


@dataclass(frozen=True, slots=True)
class ExerciseHistory:
    """What earlier days say about one exercise: the last set done and the mark to beat."""

    last_set: PastSet | None = None
    best_weight_kg: float | None = None

    @property
    def suggested_weight_kg(self) -> float | None:
        """Where the next session starts: the last weight, nudged by how that set felt."""
        if self.last_set is None or self.last_set.weight_kg is None:
            return None
        if self.last_set.effort is None:
            return self.last_set.weight_kg
        return recommend_next_weight(self.last_set.weight_kg, self.last_set.effort)


@dataclass(frozen=True, slots=True)
class WorkoutExecutionItem:
    item: DayWorkoutItem
    logs: tuple[SetLog, ...]
    history: ExerciseHistory = ExerciseHistory()

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
    """Rough kcal the logged work burned beyond resting: (MET - 1) x weight x its time.

    MET assumes steady effort and knows nothing about the load on the bar or how long the
    rests were, so two identical-looking sessions can differ by half; compute_targets()
    therefore adds back only part of it. One MET is what the body burns sitting still, and
    the day's base target already covers that, so it is taken off here.

    Timed work carries its own minutes. Counted work does not, so those exercises share
    out the planned session length between them — which is why a 90-minute tennis match
    next to a 10-minute stretch no longer averages into one wrong number.

    Returns None when there is nothing honest to measure: no logged sets, or only custom
    exercises, which carry no MET.
    """
    performed = [entry for entry in execution.items if entry.logs and entry.item.met]
    return _burn(execution, performed, _seconds_spent, weight_kg)


def planned_burn_kcal(execution: WorkoutExecution, weight_kg: float) -> int | None:
    """The same estimate for the whole workout as prescribed, before any of it is done."""
    planned = [entry for entry in execution.items if entry.item.met]
    return _burn(execution, planned, _seconds_prescribed, weight_kg)


def burn_for_targets(
    execution: WorkoutExecution, weight_kg: float, *, settled: bool
) -> int:
    """The workout burn the day's calorie target should count.

    Once the day is settled — the workout marked done or skipped, or the day in the past —
    only what was logged counts. Before that the plan does, so the extra food is there to
    plan around in the morning; sets logged beyond the plan are never undercounted.
    """
    logged = estimate_burn_kcal(execution, weight_kg) or 0
    if settled:
        return logged
    return max(logged, planned_burn_kcal(execution, weight_kg) or 0)


def _burn(
    execution: WorkoutExecution,
    entries: list[WorkoutExecutionItem],
    seconds_of: Callable[[WorkoutExecutionItem], float],
    weight_kg: float,
) -> int | None:
    if not entries:
        return None

    def net(entry: WorkoutExecutionItem, seconds: float) -> float:
        return max((entry.item.met or 0.0) - 1, 0.0) * weight_kg * seconds / 3600

    timed = [entry for entry in entries if seconds_of(entry)]
    counted = [entry for entry in entries if not seconds_of(entry)]
    total = sum(net(entry, seconds_of(entry)) for entry in timed)

    planned_min = execution.template.duration_min if execution.template else None
    if counted and planned_min:
        # The plan's minutes cover every item, so each counted item claims an equal share.
        share = planned_min * 60 / len(execution.items)
        total += sum(net(entry, share) for entry in counted)

    return round(total) or None


def _seconds_spent(entry: WorkoutExecutionItem) -> float:
    """What was actually logged, falling back to what the item prescribed per set."""
    logged = sum(log.duration_sec or 0 for log in entry.logs)
    if logged:
        return float(logged)
    prescribed = entry.item.duration_sec
    return float(prescribed * len(entry.logs)) if prescribed else 0.0


def _seconds_prescribed(entry: WorkoutExecutionItem) -> float:
    prescribed = entry.item.duration_sec
    return float(prescribed * (entry.item.sets or 1)) if prescribed else 0.0


def recommend_next_weight(weight_kg: float | None, effort: SetEffort | None) -> float | None:
    if weight_kg is None or effort is None:
        return None
    adjustment = {
        SetEffort.EASY: 2.5,
        SetEffort.APPROPRIATE: 0.0,
        SetEffort.HARD: -2.5,
    }[effort]
    return max(0.0, weight_kg + adjustment)
