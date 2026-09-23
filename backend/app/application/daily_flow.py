"""Today's flow: which step the user is on, marking meals eaten, logging sets."""

from dataclasses import dataclass
from datetime import date

from app.application.ports import AccountStore, Clock, DayStore
from app.domain.daily_flow import resolve_flow
from app.domain.errors import NotFound
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

    async def adjust(self, user_id: str, day: date, **changes: object) -> TodayView:
        await self._days.update_day(user_id, day, **changes)  # type: ignore[arg-type]
        return await self.view(user_id, day)

    async def complete_workout(self, user_id: str, day: date) -> TodayView:
        await self._days.update_day(user_id, day, workout_done_at=self._clock.now())
        return await self.view(user_id, day)

    async def mark_eaten(self, user_id: str, day: date, meal_time: MealTime) -> TodayView:
        await self._days.mark_eaten(user_id, day, meal_time, self._clock.now())
        return await self.view(user_id, day)

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
