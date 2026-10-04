"""How long counted work took, read from when its sets were logged."""

from datetime import UTC, date, datetime, timedelta

from app.domain.workout_execution import (
    DayWorkoutItem,
    SetLog,
    WorkoutExecution,
    WorkoutExecutionItem,
    estimate_burn_kcal,
)

T0 = datetime(2026, 10, 4, 1, 0, tzinfo=UTC)
WEIGHT_KG = 56


def _entry(
    exercise: str,
    met: float,
    minutes: list[float],
    *,
    duration_sec: int | None = None,
    speed_kmh: float | None = None,
    incline_pct: float | None = None,
) -> WorkoutExecutionItem:
    """An exercise whose sets were logged `minutes` after T0."""
    item = DayWorkoutItem(
        id=exercise,
        exercise_id=exercise,
        exercise_name=exercise,
        sort_order=0,
        sets=len(minutes),
        reps=None if duration_sec else "10",
        duration_sec=duration_sec,
        weight_kg=None,
        rest_sec=60,
        note=None,
        met=met,
        replaced_exercise_name=None,
        replacement_reason=None,
        source_item_id=None,
    )
    logs = tuple(
        SetLog(
            day_workout_item_id=exercise,
            exercise_id=exercise,
            set_index=index,
            reps_done=None if duration_sec else 10,
            duration_sec=duration_sec,
            weight_kg=None,
            effort=None,
            done_at=T0 + timedelta(minutes=at),
            speed_kmh=speed_kmh,
            incline_pct=incline_pct,
        )
        for index, at in enumerate(minutes)
    )
    return WorkoutExecutionItem(item=item, logs=logs)


def _burn(*entries: WorkoutExecutionItem, trained_sec: int | None = None) -> int | None:
    workout = WorkoutExecution(date(2026, 10, 4), None, entries, trained_sec=trained_sec)
    return estimate_burn_kcal(workout, WEIGHT_KG)


# A 40-minute walk logged at T0: (6 - 1) x 56 kg x 40 min.
WALK = 187


def test_the_time_between_logged_sets_is_the_time_they_took():
    walk = _entry("walk", 6.0, [0], duration_sec=2400)
    # Logged 3, 6 and 10 minutes after the walk: 10 minutes of pulldowns, rests and all,
    # (3.5 - 1) x 56 kg x 10 min = 23.
    pulldown = _entry("pulldown", 3.5, [3, 6, 10])
    assert _burn(walk, pulldown) == WALK + 23


def test_sets_logged_all_at_once_fall_back_to_the_per_set_estimate():
    walk = _entry("walk", 6.0, [0], duration_sec=2400)
    # Typed in afterwards, 補記 stamps them with the day's last log, so there are no gaps
    # to read: 3 x (10 reps x 3 s + 60 s) = 270 s, 10.5.
    pulldown = _entry("pulldown", 3.5, [0, 0, 0])
    assert _burn(walk, pulldown) == WALK + 10


def test_a_long_gap_is_a_break_not_training():
    # 3 minutes, then an hour away: only 20 minutes of that hour count, 23 in all,
    # (3.5 - 1) x 56 kg x 23 min = 54.
    pulldown = _entry("pulldown", 3.5, [0, 3, 63])
    assert _burn(pulldown) == 54


def test_a_longer_clock_still_wins_over_the_logged_gaps():
    pulldown = _entry("pulldown", 3.5, [0, 3, 6])
    # Focus mode clocked half an hour; the gaps only show six minutes of it.
    assert _burn(pulldown, trained_sec=1800) == 70


def test_a_treadmill_walk_with_speed_and_incline_is_costed_by_the_acsm_equation():
    # 4 km/h is 66.7 m/min; up 10 %: 3.5 + 0.1 x 66.7 + 1.8 x 66.7 x 0.10 = 22.2 ml/kg/min,
    # 6.33 MET. (6.33 - 1) x 56 kg x 40 min = 199, where the flat MET 6.0 said 187.
    walk = _entry("walk", 6.0, [0], duration_sec=2400, speed_kmh=4, incline_pct=10)
    assert _burn(walk) == 199


def test_a_run_is_costed_by_the_running_equation():
    # 10 km/h is 166.7 m/min, up 1 %: 3.5 + 0.2 x 166.7 + 0.9 x 166.7 x 0.01 = 38.3,
    # 10.95 MET. (10.95 - 1) x 56 kg x 30 min = 279.
    run = _entry("walk", 6.0, [0], duration_sec=1800, speed_kmh=10, incline_pct=1)
    assert _burn(run) == 279


def test_a_speed_without_an_incline_is_level_ground():
    # 5 km/h flat: 3.5 + 8.3 = 11.8 ml/kg/min, 3.38 MET: (3.38 - 1) x 56 x 30 min = 67.
    walk = _entry("walk", 6.0, [0], duration_sec=1800, speed_kmh=5)
    assert _burn(walk) == 67

