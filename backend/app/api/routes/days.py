from datetime import date

from fastapi import APIRouter

from app.api.deps import CurrentUserId, DailyFlow
from app.api.schemas import DayPatch, SetLogIn, TodayOut
from app.domain.models import MealTime

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
