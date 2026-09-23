"""今日流程的步驟順序與目前位置。不存 DB,一律由當天事實推算。"""

from app.domain.models import DayFacts, DayFlow, FlowStep, MealTime, WorkoutTime

_MEAL_STEP: dict[MealTime, FlowStep] = {
    MealTime.BREAKFAST: FlowStep.BREAKFAST,
    MealTime.LUNCH: FlowStep.LUNCH,
    MealTime.DINNER: FlowStep.DINNER,
}


def _step_order(workout_time: WorkoutTime, has_workout: bool) -> tuple[FlowStep, ...]:
    meals = [FlowStep.BODY, FlowStep.BREAKFAST, FlowStep.LUNCH, FlowStep.DINNER]
    if not has_workout:
        return tuple(meals)
    # 早上練 → 早餐後;傍晚練 → 晚餐前
    insert_at = 2 if workout_time is WorkoutTime.AM else 3
    return tuple(meals[:insert_at] + [FlowStep.WORKOUT] + meals[insert_at:])


def resolve_flow(facts: DayFacts) -> DayFlow:
    steps = _step_order(facts.workout_time, facts.has_workout_planned)

    completed: set[FlowStep] = set()
    if facts.body_logged:
        completed.add(FlowStep.BODY)
    if facts.workout_done_at is not None:
        completed.add(FlowStep.WORKOUT)
    for slot in facts.slots:
        if slot.eaten_at is not None and slot.meal_time in _MEAL_STEP:
            completed.add(_MEAL_STEP[slot.meal_time])

    current = next((s for s in steps if s not in completed), FlowStep.DONE)
    eaten_kcal = sum(s.kcal for s in facts.slots if s.eaten_at is not None)

    return DayFlow(
        steps=steps,
        completed=frozenset(completed),
        current=current,
        eaten_kcal=round(eaten_kcal, 1),
    )
