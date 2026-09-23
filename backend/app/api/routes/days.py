from datetime import date

from fastapi import APIRouter

from app.api.deps import CurrentUserId, DailyFlow, DailyPlan
from app.api.schemas import DayPatch, DayPlanOut, SetLogIn, ShuffleIn, SwapItemIn, TodayOut
from app.domain.models import MealTime, SwapBasis

router = APIRouter(prefix="/days", tags=["days"])


@router.get("/{day}", response_model=TodayOut)
async def read_day(day: date, user_id: CurrentUserId, service: DailyFlow) -> TodayOut:
    return TodayOut.of(await service.view(user_id, day))


@router.patch("/{day}", response_model=TodayOut)
async def update_day(
    day: date, payload: DayPatch, user_id: CurrentUserId, service: DailyFlow
) -> TodayOut:
    changes = payload.model_dump(exclude_unset=True, exclude={"workout_done"})
    if changes:
        await service.adjust(user_id, day, **changes)
    if payload.workout_done:
        return TodayOut.of(await service.complete_workout(user_id, day))
    return TodayOut.of(await service.view(user_id, day))


@router.patch("/{day}/meals/{meal_time}", response_model=TodayOut)
async def mark_eaten(
    day: date, meal_time: MealTime, user_id: CurrentUserId, service: DailyFlow
) -> TodayOut:
    return TodayOut.of(await service.mark_eaten(user_id, day, meal_time))


@router.put("/{day}/workout/sets", response_model=TodayOut)
async def log_set(
    day: date, payload: SetLogIn, user_id: CurrentUserId, service: DailyFlow
) -> TodayOut:
    return TodayOut.of(
        await service.log_set(
            user_id,
            day,
            template_item_id=payload.template_item_id,
            exercise_id=payload.exercise_id,
            set_index=payload.set_index,
            reps_done=payload.reps_done,
            weight_kg=payload.weight_kg,
        )
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
    meal_time: MealTime,
    payload: SwapItemIn,
    user_id: CurrentUserId,
    service: DailyPlan,
) -> DayPlanOut:
    """Swap one food on today's plate; the portion is converted for you."""
    return DayPlanOut.of(
        await service.swap_item(
            user_id,
            day,
            meal_time,
            payload.item_id,
            payload.to_food_id,
            SwapBasis(payload.match) if payload.match else None,
        )
    )
