"""Step order and current position in today's flow.

Never stored — always derived from what actually happened that day.
"""

from app.domain.models import DayFacts, DayFlow, FlowStep, MealTime, Nutrients, WorkoutTime

_MEAL_STEP: dict[MealTime, FlowStep] = {
    MealTime.BREAKFAST: FlowStep.BREAKFAST,
    MealTime.LUNCH: FlowStep.LUNCH,
    MealTime.DINNER: FlowStep.DINNER,
}


def _step_order(workout_time: WorkoutTime, has_workout: bool) -> tuple[FlowStep, ...]:
    meals = [FlowStep.BODY, FlowStep.BREAKFAST, FlowStep.LUNCH, FlowStep.DINNER]
    if not has_workout:
        return tuple(meals)
    # Morning workout goes after breakfast; evening workout goes before dinner.
    insert_at = 2 if workout_time is WorkoutTime.AM else 3
    return tuple(meals[:insert_at] + [FlowStep.WORKOUT] + meals[insert_at:])


def resolve_flow(facts: DayFacts) -> DayFlow:
    steps = _step_order(facts.workout_time, facts.has_workout_planned)

    completed: set[FlowStep] = set()
    if facts.body_logged:
        completed.add(FlowStep.BODY)
    if facts.workout_done_at is not None or facts.workout_skipped_at is not None:
        completed.add(FlowStep.WORKOUT)
    for slot in facts.slots:
        if (
            slot.eaten_at is not None or slot.skipped_at is not None
        ) and slot.meal_time in _MEAL_STEP:
            completed.add(_MEAL_STEP[slot.meal_time])

    current = next((s for s in steps if s not in completed), FlowStep.DONE)

    eaten = Nutrients(0, 0, 0, 0)
    for slot in facts.slots:
        # Extras are only ever recorded after the fact, so there is nothing to mark: a
        # photographed snack counts the moment it is saved.
        if slot.eaten_at is not None or slot.meal_time is MealTime.EXTRAS:
            eaten += slot.nutrients

    return DayFlow(
        steps=steps,
        completed=frozenset(completed),
        current=current,
        eaten=Nutrients(
            kcal=round(eaten.kcal, 1),
            protein_g=round(eaten.protein_g, 1),
            fat_g=round(eaten.fat_g, 1),
            carb_g=round(eaten.carb_g, 1),
        ),
    )
