from datetime import UTC, date, datetime

from app.domain.daily_flow import resolve_flow
from app.domain.models import DayFacts, FlowStep, MealSlot, MealTime, WorkoutTime

TODAY = date(2026, 9, 22)
NOON = datetime(2026, 9, 22, 12, 0, tzinfo=UTC)


def facts(**overrides) -> DayFacts:
    defaults = dict(
        date=TODAY,
        body_logged=False,
        slots=(
            MealSlot(MealTime.BREAKFAST, None, None, None, 0),
            MealSlot(MealTime.LUNCH, None, None, None, 0),
            MealSlot(MealTime.DINNER, None, None, None, 0),
        ),
        workout_time=WorkoutTime.PM,
        workout_done_at=None,
        workout_skipped_at=None,
        has_workout_planned=True,
    )
    return DayFacts(**{**defaults, **overrides})


def test_evening_workout_sits_before_dinner():
    assert resolve_flow(facts()).steps == (
        FlowStep.BODY,
        FlowStep.BREAKFAST,
        FlowStep.LUNCH,
        FlowStep.WORKOUT,
        FlowStep.DINNER,
    )


def test_morning_workout_sits_after_breakfast():
    assert resolve_flow(facts(workout_time=WorkoutTime.AM)).steps == (
        FlowStep.BODY,
        FlowStep.BREAKFAST,
        FlowStep.WORKOUT,
        FlowStep.LUNCH,
        FlowStep.DINNER,
    )


def test_rest_day_has_four_steps():
    assert FlowStep.WORKOUT not in resolve_flow(facts(has_workout_planned=False)).steps


def test_day_starts_at_weigh_in():
    assert resolve_flow(facts()).current is FlowStep.BODY


def test_advances_past_completed_steps():
    flow = resolve_flow(
        facts(
            body_logged=True,
            slots=(
                MealSlot(MealTime.BREAKFAST, "m1", NOON, None, 440),
                MealSlot(MealTime.LUNCH, None, None, None, 0),
                MealSlot(MealTime.DINNER, None, None, None, 0),
            ),
        )
    )
    assert flow.current is FlowStep.LUNCH
    assert flow.eaten_kcal == 440


def test_going_back_to_fix_a_skipped_step():
    """Dinner marked eaten before the weigh-in — the current step falls back to body."""
    flow = resolve_flow(
        facts(
            slots=(
                MealSlot(MealTime.BREAKFAST, None, None, None, 0),
                MealSlot(MealTime.LUNCH, None, None, None, 0),
                MealSlot(MealTime.DINNER, "m3", NOON, None, 490),
            )
        )
    )
    assert flow.current is FlowStep.BODY
    assert FlowStep.DINNER in flow.completed


def test_everything_done():
    flow = resolve_flow(
        facts(
            body_logged=True,
            workout_done_at=NOON,
            slots=(
                MealSlot(MealTime.BREAKFAST, "m1", NOON, None, 440),
                MealSlot(MealTime.LUNCH, "m2", NOON, None, 430),
                MealSlot(MealTime.DINNER, "m3", NOON, None, 490),
            ),
        )
    )
    assert flow.current is FlowStep.DONE
    assert flow.eaten_kcal == 1360


def test_extras_count_toward_kcal_but_are_not_a_step():
    flow = resolve_flow(
        facts(
            slots=(
                MealSlot(MealTime.BREAKFAST, None, None, None, 0),
                MealSlot(MealTime.LUNCH, None, None, None, 0),
                MealSlot(MealTime.DINNER, None, None, None, 0),
                MealSlot(MealTime.EXTRAS, None, NOON, None, 120),
            )
        )
    )
    assert flow.eaten_kcal == 120
    assert FlowStep.BODY is flow.current


def test_skipped_meals_and_workout_complete_their_flow_steps_without_adding_kcal():
    flow = resolve_flow(
        facts(
            body_logged=True,
            workout_skipped_at=NOON,
            slots=(
                MealSlot(MealTime.BREAKFAST, "m1", None, NOON, 440),
                MealSlot(MealTime.LUNCH, "m2", NOON, None, 430),
                MealSlot(MealTime.DINNER, "m3", None, NOON, 490),
            ),
        )
    )
    assert flow.current is FlowStep.DONE
    assert flow.eaten_kcal == 430
