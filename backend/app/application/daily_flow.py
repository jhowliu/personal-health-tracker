"""Today's flow: which step the user is on, marking meals eaten, logging sets."""

from dataclasses import dataclass
from datetime import date

from app.application.ports import AccountStore, Clock, DayStore
from app.domain.daily_flow import resolve_flow
from app.domain.errors import NotFound, ValidationFailed
from app.domain.models import DayFlow, MealTime, Targets
from app.domain.nutrition import compute_targets


@dataclass(frozen=True, slots=True)
class TodayView:
    date: date
    flow: DayFlow
    targets: Targets
    streak: int


class DailyFlowService:
    def __init__(self, days: DayStore, accounts: AccountStore, clock: Clock) -> None:
        self._days = days
        self._accounts = accounts
        self._clock = clock

    async def view(self, user_id: str, day: date | None = None) -> TodayView:
        profile = await self._accounts.load_profile(user_id)
        if profile is None:
            raise NotFound("還沒有建立個人資料")

        on = day or self._clock.today(profile.timezone)
        facts = await self._days.load_facts(user_id, on, profile)
        return TodayView(
            date=on,
            flow=resolve_flow(facts),
            targets=compute_targets(profile, on),
            streak=await self._days.streak_until(user_id, on),
        )

    async def adjust(
        self,
        user_id: str,
        day: date,
        *,
        workout_done: bool = False,
        workout_skipped: bool = False,
        **changes: object,
    ) -> TodayView:
        if workout_done and workout_skipped:
            raise ValidationFailed("運動不能同時標記完成與跳過")
        state = "done" if workout_done else "skipped" if workout_skipped else None
        await self._days.update_day(
            user_id,
            day,
            await self._profile(user_id),
            workout_state=state,
            workout_state_at=self._clock.now() if state else None,
            **changes,
        )  # type: ignore[arg-type]
        return await self.view(user_id, day)

    async def complete_workout(self, user_id: str, day: date) -> TodayView:
        await self._days.update_day(
            user_id,
            day,
            await self._profile(user_id),
            workout_state="done",
            workout_state_at=self._clock.now(),
        )
        return await self.view(user_id, day)

    async def set_meal_state(
        self, user_id: str, day: date, meal_time: MealTime, state: str
    ) -> TodayView:
        if state not in {"eaten", "skipped", "planned"}:
            raise ValidationFailed("無效的餐點狀態")
        await self._days.set_meal_state(
            user_id,
            day,
            meal_time,
            state,
            self._clock.now(),
            await self._profile(user_id),
        )
        return await self.view(user_id, day)

    async def _profile(self, user_id: str):
        profile = await self._accounts.load_profile(user_id)
        if profile is None:
            raise NotFound("還沒有建立個人資料")
        return profile

    async def log_set(
        self,
        user_id: str,
        day: date,
        *,
        template_item_id: str,
        exercise_id: str,
        set_index: int,
        reps_done: int | None,
        weight_kg: float | None,
    ) -> TodayView:
        await self._days.log_set(
            user_id,
            day,
            template_item_id,
            exercise_id,
            set_index,
            reps_done,
            weight_kg,
            self._clock.now(),
        )
        return await self.view(user_id, day)
