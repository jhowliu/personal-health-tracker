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
    SetLogIn,
    SetLogResultOut,
    ShuffleIn,
    SwapItemIn,
    TodayOut,
    WorkoutExecutionOut,
    WorkoutItemIn,
    WorkoutItemPatch,
)
from app.domain.models import MealTime, SwapBasis
from app.domain.workout_execution import SetEffort

router = APIRouter(prefix="/days", tags=["days"])


@router.get("/{day}", response_model=TodayOut)
async def read_day(day: date, user_id: CurrentUserId, service: DailyFlow) -> TodayOut:
    return TodayOut.of(await service.view(user_id, day))


@router.patch("/{day}", response_model=TodayOut)
async def update_day(
    day: date, payload: DayPatch, user_id: CurrentUserId, service: DailyFlow
) -> TodayOut:
    changes = payload.model_dump(exclude_unset=True, exclude={"workout_done", "workout_skipped"})
    return TodayOut.of(
        await service.adjust(
            user_id,
            day,
            workout_done=payload.workout_done,
            workout_skipped=payload.workout_skipped,
            **changes,
        )
    )


@router.patch("/{day}/meals/{meal_time}", response_model=TodayOut)
async def set_meal_state(
    day: date,
    meal_time: str,
    user_id: CurrentUserId,
    service: DailyFlow,
    payload: MealStateIn | None = None,
) -> TodayOut:
    if meal_time not in {"breakfast", "lunch", "dinner"}:
        raise HTTPException(status_code=422, detail="meal_time 必須是早餐、午餐或晚餐")
    state = (payload or MealStateIn()).state
    return TodayOut.of(
        await service.set_meal_state(user_id, day, MealTime(meal_time), state)
    )


@router.get("/{day}/workout", response_model=WorkoutExecutionOut)
async def read_workout(
    day: date, user_id: CurrentUserId, service: WorkoutExecution
) -> WorkoutExecutionOut:
    return WorkoutExecutionOut.of(await service.view(user_id, day))


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
        await service.update_item(user_id, day, item_id, payload.model_dump(exclude_unset=True))
    )


@router.delete("/{day}/workout/items/{item_id}", status_code=204)
async def delete_workout_item(
    day: date, item_id: str, user_id: CurrentUserId, service: WorkoutExecution
) -> None:
    await service.delete_item(user_id, day, item_id)


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
    )
    return SetLogResultOut(
        today=TodayOut.of(await flow.view(user_id, day)), next_weight_kg=result.next_weight_kg
    )


@router.get("/{day}/plan", response_model=DayPlanOut)
async def read_plan(day: date, user_id: CurrentUserId, service: DailyPlan) -> DayPlanOut:
    """Today's plate. Generates one on first look when auto-assign is on."""
    return DayPlanOut.of(await service.view(user_id, day))


@router.post("/{day}/plan/shuffle", response_model=DayPlanOut)
async def shuffle_plan(
    day: date, payload: ShuffleIn, user_id: CurrentUserId, service: DailyPlan
) -> DayPlanOut:
    slot = MealTime(payload.meal_time) if payload.meal_time else None
    return DayPlanOut.of(await service.shuffle(user_id, day, slot))


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


def _meal_time(value: str) -> MealTime:
    if value not in {"breakfast", "lunch", "dinner"}:
        raise HTTPException(status_code=422, detail="meal_time 必須是早餐、午餐或晚餐")
    return MealTime(value)
