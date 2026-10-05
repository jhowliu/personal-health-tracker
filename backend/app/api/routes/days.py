from datetime import date

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUserId, DailyFlow, DailyPlan, Extras, WorkoutExecution
from app.api.schemas import (
    DayPatch,
    DayPlanOut,
    ExtraItemIn,
    ExtraItemOut,
    MealStateIn,
    PlanItemPatchIn,
    PlanMealIn,
    SaveDayTemplateIn,
    SetLogIn,
    SetLogResultOut,
    SetRecordsIn,
    SwapItemIn,
    TemplateOut,
    TodayOut,
    WorkoutExecutionOut,
    WorkoutItemIn,
    WorkoutItemPatch,
)
from app.application.commands import DayAdjustment, SetRecord, WorkoutItemChange
from app.domain.models import PLANNED_SLOTS, MealTime, SwapBasis, WorkoutTime
from app.domain.workout_execution import ReplacementReason, SetEffort

router = APIRouter(prefix="/days", tags=["days"])


@router.get("/{day}", response_model=TodayOut)
async def read_day(day: date, user_id: CurrentUserId, service: DailyFlow) -> TodayOut:
    return TodayOut.of(await service.view(user_id, day))


@router.patch("/{day}", response_model=TodayOut)
async def update_day(
    day: date, payload: DayPatch, user_id: CurrentUserId, service: DailyFlow
) -> TodayOut:
    change = DayAdjustment(
        workout_time=WorkoutTime(payload.workout_time) if payload.workout_time else None,
        workout_done=payload.workout_done,
        workout_skipped=payload.workout_skipped,
        trained_sec=payload.trained_sec,
    )
    return TodayOut.of(await service.adjust(user_id, day, change))


@router.patch("/{day}/meals/{meal_time}", response_model=TodayOut)
async def set_meal_state(
    day: date,
    meal_time: str,
    user_id: CurrentUserId,
    service: DailyFlow,
    payload: MealStateIn | None = None,
) -> TodayOut:
    state = (payload or MealStateIn()).state
    return TodayOut.of(await service.set_meal_state(user_id, day, _meal_time(meal_time), state))


@router.get("/{day}/workout", response_model=WorkoutExecutionOut)
async def read_workout(
    day: date, user_id: CurrentUserId, service: WorkoutExecution
) -> WorkoutExecutionOut:
    return WorkoutExecutionOut.of(await service.view(user_id, day))


@router.delete("/{day}/workout", status_code=204)
async def clear_workout(day: date, user_id: CurrentUserId, service: WorkoutExecution) -> None:
    await service.clear(user_id, day)


@router.post("/{day}/workout/save-as-template", response_model=TemplateOut, status_code=201)
async def save_day_as_template(
    day: date, payload: SaveDayTemplateIn, user_id: CurrentUserId, service: WorkoutExecution
) -> TemplateOut:
    return TemplateOut.of(await service.save_as_template(user_id, day, payload.name))


@router.post("/{day}/workout/items", response_model=WorkoutExecutionOut, status_code=201)
async def add_workout_item(
    day: date,
    payload: WorkoutItemIn,
    user_id: CurrentUserId,
    service: WorkoutExecution,
) -> WorkoutExecutionOut:
    return WorkoutExecutionOut.of(
        await service.add_item(
            user_id,
            day,
            **payload.model_dump(),
        )
    )


@router.patch("/{day}/workout/items/{item_id}", response_model=WorkoutExecutionOut)
async def update_workout_item(
    day: date,
    item_id: str,
    payload: WorkoutItemPatch,
    user_id: CurrentUserId,
    service: WorkoutExecution,
) -> WorkoutExecutionOut:
    return WorkoutExecutionOut.of(
        await service.update_item(user_id, day, item_id, _item_change(payload))
    )


@router.delete("/{day}/workout/items/{item_id}", status_code=204)
async def delete_workout_item(
    day: date, item_id: str, user_id: CurrentUserId, service: WorkoutExecution
) -> None:
    await service.delete_item(user_id, day, item_id)


@router.put("/{day}/workout/items/{item_id}/sets", response_model=SetLogResultOut)
async def replace_sets(
    day: date,
    item_id: str,
    payload: SetRecordsIn,
    user_id: CurrentUserId,
    service: WorkoutExecution,
    flow: DailyFlow,
) -> SetLogResultOut:
    result = await service.replace_sets(
        user_id,
        day,
        item_id,
        tuple(
            SetRecord(
                reps_done=record.reps_done,
                duration_sec=record.duration_sec,
                weight_kg=record.weight_kg,
                effort=SetEffort(record.effort) if record.effort else None,
                speed_kmh=record.speed_kmh,
                incline_pct=record.incline_pct,
            )
            for record in payload.sets
        ),
    )
    return SetLogResultOut(
        today=TodayOut.of(await flow.view(user_id, day)), next_weight_kg=result.next_weight_kg
    )


@router.put("/{day}/workout/sets", response_model=SetLogResultOut)
async def log_set(
    day: date,
    payload: SetLogIn,
    user_id: CurrentUserId,
    service: WorkoutExecution,
    flow: DailyFlow,
) -> SetLogResultOut:
    result = await service.log_set(
        user_id,
        day,
        day_workout_item_id=payload.day_workout_item_id,
        exercise_id=payload.exercise_id,
        set_index=payload.set_index,
        reps_done=payload.reps_done,
        duration_sec=payload.duration_sec,
        weight_kg=payload.weight_kg,
        effort=SetEffort(payload.effort) if payload.effort else None,
        speed_kmh=payload.speed_kmh,
        incline_pct=payload.incline_pct,
    )
    return SetLogResultOut(
        today=TodayOut.of(await flow.view(user_id, day)), next_weight_kg=result.next_weight_kg
    )


@router.get("/{day}/plan", response_model=DayPlanOut)
async def read_plan(day: date, user_id: CurrentUserId, service: DailyPlan) -> DayPlanOut:
    """Today's plate: what has been logged for each meal so far."""
    return DayPlanOut.of(await service.view(user_id, day))


@router.post("/{day}/plan/{meal_time}/meal", response_model=DayPlanOut, status_code=201)
async def add_plan_meal(
    day: date, meal_time: str, payload: PlanMealIn, user_id: CurrentUserId, service: DailyPlan
) -> DayPlanOut:
    """Put one of the user's saved meals on the plate, at its saved portions."""
    return DayPlanOut.of(
        await service.add_meal(user_id, day, _meal_time(meal_time), payload.meal_id)
    )


@router.patch("/{day}/plan/{meal_time}/items", response_model=DayPlanOut)
async def swap_plan_item(
    day: date,
    meal_time: str,
    payload: SwapItemIn,
    user_id: CurrentUserId,
    service: DailyPlan,
) -> DayPlanOut:
    """Swap one food on today's plate; the portion is converted for you."""
    return DayPlanOut.of(
        await service.swap_item(
            user_id,
            day,
            _meal_time(meal_time),
            payload.item_id,
            payload.to_food_id,
            SwapBasis(payload.match) if payload.match else None,
        )
    )


@router.post("/{day}/plan/{meal_time}/items", response_model=DayPlanOut, status_code=201)
async def add_plan_item(
    day: date,
    meal_time: str,
    payload: ExtraItemIn,
    user_id: CurrentUserId,
    service: DailyPlan,
) -> DayPlanOut:
    return DayPlanOut.of(
        await service.add_item(
            user_id,
            day,
            _meal_time(meal_time),
            food_id=payload.food_id,
            grams=payload.grams,
            custom_name=payload.custom_name,
            nutrients=payload.nutrients.to_domain() if payload.nutrients else None,
            photo_id=payload.photo_id,
        )
    )


@router.patch("/{day}/plan/{meal_time}/items/{item_id}", response_model=DayPlanOut)
async def update_plan_item(
    day: date,
    meal_time: str,
    item_id: str,
    payload: PlanItemPatchIn,
    user_id: CurrentUserId,
    service: DailyPlan,
) -> DayPlanOut:
    return DayPlanOut.of(
        await service.update_item(user_id, day, _meal_time(meal_time), item_id, payload.grams)
    )


@router.delete("/{day}/plan/{meal_time}/items/{item_id}", status_code=204)
async def delete_plan_item(
    day: date, meal_time: str, item_id: str, user_id: CurrentUserId, service: DailyPlan
) -> None:
    await service.delete_item(user_id, day, _meal_time(meal_time), item_id)


@router.post("/{day}/meals/extras/items", response_model=ExtraItemOut, status_code=201)
async def add_extra(
    day: date, payload: ExtraItemIn, user_id: CurrentUserId, service: Extras
) -> ExtraItemOut:
    item = await service.add(
        user_id,
        day,
        food_id=payload.food_id,
        grams=payload.grams,
        custom_name=payload.custom_name,
        nutrients=payload.nutrients.to_domain() if payload.nutrients else None,
        photo_id=payload.photo_id,
    )
    return ExtraItemOut.of(item)


@router.delete("/{day}/meals/extras/items/{item_id}", status_code=204)
async def delete_extra(day: date, item_id: str, user_id: CurrentUserId, service: Extras) -> None:
    await service.remove(user_id, day, item_id)


def _item_change(payload: WorkoutItemPatch) -> WorkoutItemChange:
    given = payload.model_dump(exclude_unset=True)
    if given.get("replacement_reason") is not None:
        given["replacement_reason"] = ReplacementReason(given["replacement_reason"])
    return WorkoutItemChange(**given)


def _meal_time(value: str) -> MealTime:
    """A path segment that must name one of the planned Meal slots."""
    slot = next((s for s in PLANNED_SLOTS if s.value == value), None)
    if slot is None:
        raise HTTPException(status_code=422, detail="meal_time 必須是早餐、午餐或晚餐")
    return slot
