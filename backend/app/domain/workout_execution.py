"""A day's workout: what was prescribed for that date, and what actually happened."""

import re
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
    # A treadmill set's settings, when given; they cost it by the ACSM equations.
    speed_kmh: float | None = None
    incline_pct: float | None = None


@dataclass(frozen=True, slots=True)
class PastSet:
    """A set from an earlier day: where the next session of that exercise starts from."""

    date: date
    weight_kg: float | None
    reps_done: int | None
    duration_sec: int | None
    effort: SetEffort | None
    speed_kmh: float | None = None
    incline_pct: float | None = None


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
    # Seconds focus mode clocked on the day, over every session; None when it never ran.
    trained_sec: int | None = None


@dataclass(frozen=True, slots=True)
class SetLogResult:
    next_weight_kg: float | None


# A counted set with no clock on it is costed at about this long a rep, plus its rest.
SECONDS_PER_REP = 3
DEFAULT_REPS = 10
# Above this a treadmill set is a run, below it a walk (ACSM: walking holds to about
# 100 m/min, running from about 134; this splits the jog in between).
RUNNING_KMH = 8.0
# Between two sets logged one at a time, the gap is the later set's time, rest included;
# one longer than this is a break, not training.
LONGEST_GAP_SEC = 20 * 60


def estimate_burn_kcal(execution: WorkoutExecution, weight_kg: float) -> int | None:
    """Rough kcal the logged work burned beyond resting: (MET - 1) x weight x its time.

    MET assumes steady effort and knows nothing about the load on the bar or how long the
    rests were, so two identical-looking sessions can differ by half; compute_targets()
    therefore adds back only part of it. One MET is what the body burns sitting still, and
    the day's base target already covers that, so it is taken off here.

    Timed work carries its own minutes. Counted work does not, so its time is the longest
    of three readings, shared over the counted exercises in proportion to the first:
    each set costed at its reps x SECONDS_PER_REP plus the rest after it; the time focus
    mode clocked, less what the timed work took; and the gaps between the sets as they
    were logged. Sets typed in afterwards have no gaps and nothing clocked, so they fall
    back to the per-set cost; a short reading only means some work happened off it.

    Returns None when there is nothing honest to measure: no logged sets, or only custom
    exercises, which carry no MET.
    """
    logged = [entry for entry in execution.items if entry.logs]
    counted = {entry.item.id: _set_seconds(entry) for entry in logged if not _seconds_spent(entry)}
    clocked = (execution.trained_sec or 0) - sum(_seconds_spent(entry) for entry in logged)
    taken = max(clocked, _logged_gaps(logged))
    estimated = sum(counted.values())
    stretch = max(taken / estimated, 1.0) if estimated else 1.0

    def kcal(entry: WorkoutExecutionItem) -> float:
        if any(log.speed_kmh for log in entry.logs):
            # A treadmill set with its speed (and incline) says more than the flat MET.
            return sum(
                _net_kcal(_log_met(entry, log), weight_kg, _log_seconds(entry, log))
                for log in entry.logs
            )
        seconds = _seconds_spent(entry) or counted[entry.item.id] * stretch
        return _net_kcal(entry.item.met, weight_kg, seconds)

    costed = [
        entry for entry in logged if entry.item.met or any(log.speed_kmh for log in entry.logs)
    ]
    return _burn(costed, kcal)


def burn_for_targets(
    execution: WorkoutExecution, weight_kg: float, *, finished: bool
) -> int:
    """The workout burn the day's calorie target should count: what was logged, and only
    once the workout is finished — marked done, or on a day already past.

    Until then nothing counts, not the plan nor the sets logged so far, so the target never
    hands out food for training that has not happened yet.
    """
    return (estimate_burn_kcal(execution, weight_kg) or 0) if finished else 0


def treadmill_met(speed_kmh: float, incline_pct: float | None) -> float:
    """The ACSM metabolic equations: oxygen cost from speed and grade, in METs.

    Walking costs 0.1 ml/kg/min per m/min plus 1.8 per m/min of climb; running 0.2 and 0.9.
    Each adds to the 3.5 ml/kg/min of rest, which is also what one MET is.
    """
    metres_per_min = speed_kmh * 1000 / 60
    grade = (incline_pct or 0.0) / 100
    if speed_kmh <= RUNNING_KMH:
        vo2 = 3.5 + 0.1 * metres_per_min + 1.8 * metres_per_min * grade
    else:
        vo2 = 3.5 + 0.2 * metres_per_min + 0.9 * metres_per_min * grade
    return vo2 / 3.5


def _burn(
    entries: list[WorkoutExecutionItem], kcal_of: Callable[[WorkoutExecutionItem], float]
) -> int | None:
    if not entries:
        return None
    return round(sum(kcal_of(entry) for entry in entries)) or None


def _net_kcal(met: float | None, weight_kg: float, seconds: float) -> float:
    """kcal beyond resting: the resting MET is already in the day's base target."""
    return max((met or 0.0) - 1, 0.0) * weight_kg * seconds / 3600


def _log_met(entry: WorkoutExecutionItem, log: SetLog) -> float | None:
    return treadmill_met(log.speed_kmh, log.incline_pct) if log.speed_kmh else entry.item.met


def _log_seconds(entry: WorkoutExecutionItem, log: SetLog) -> float:
    return float(log.duration_sec or entry.item.duration_sec or 0)


def _logged_gaps(logged: list[WorkoutExecutionItem]) -> float:
    """The time before each counted set, measured from whatever was logged just before it."""
    logs = sorted(
        ((log.done_at, entry) for entry in logged for log in entry.logs), key=lambda pair: pair[0]
    )
    return sum(
        min((at - before).total_seconds(), LONGEST_GAP_SEC)
        for (before, _), (at, entry) in zip(logs, logs[1:], strict=False)
        if not _seconds_spent(entry)
    )


def _seconds_spent(entry: WorkoutExecutionItem) -> float:
    """What was actually logged, falling back to what the item prescribed per set."""
    logged = sum(log.duration_sec or 0 for log in entry.logs)
    if logged:
        return float(logged)
    prescribed = entry.item.duration_sec
    return float(prescribed * len(entry.logs)) if prescribed else 0.0


def _prescribed_reps(entry: WorkoutExecutionItem) -> int:
    match = re.search(r"\d+", entry.item.reps or "")
    return int(match.group()) if match else DEFAULT_REPS


def _set_seconds(entry: WorkoutExecutionItem) -> float:
    """The logged sets of counted work, each at its reps' worth of time plus the rest."""
    return float(
        sum(
            (log.reps_done or _prescribed_reps(entry)) * SECONDS_PER_REP + entry.item.rest_sec
            for log in entry.logs
        )
    )


def recommend_next_weight(weight_kg: float | None, effort: SetEffort | None) -> float | None:
    if weight_kg is None or effort is None:
        return None
    adjustment = {
        SetEffort.EASY: 2.5,
        SetEffort.APPROPRIATE: 0.0,
        SetEffort.HARD: -2.5,
    }[effort]
    return max(0.0, weight_kg + adjustment)
