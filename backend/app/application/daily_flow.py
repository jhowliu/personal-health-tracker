"""Today's flow: which step the user is on, marking meals eaten."""

from dataclasses import dataclass
from datetime import date

from app.application.commands import DayAdjustment
from app.application.ports import AccountStore, Clock, DayStore, WorkoutExecutionStore
from app.domain.daily_flow import resolve_flow
from app.domain.errors import NotFound, ValidationFailed
from app.domain.models import PLANNED_SLOTS, DayFlow, MealTime, Targets
from app.domain.nutrition import compute_targets
from app.domain.streak import STREAK_WINDOW_DAYS, streak_until
from app.domain.workout_execution import burn_for_targets


@dataclass(frozen=True, slots=True)
class TodayView:
    date: date
    flow: DayFlow
    targets: Targets
    streak: int


class DailyFlowService:
    def __init__(
        self,
        days: DayStore,
        accounts: AccountStore,
        workouts: WorkoutExecutionStore,
        clock: Clock,
    ) -> None:
        self._days = days
        self._accounts = accounts
        self._workouts = workouts
        self._clock = clock

    async def view(self, user_id: str, day: date | None = None) -> TodayView:
        profile = await self._accounts.load_profile(user_id)
        if profile is None:
            raise NotFound("還沒有建立個人資料")

        today = self._clock.today(profile.timezone)
        on = day or today
        facts = await self._days.load_facts(user_id, on)
        settled = (
            on < today
            or facts.workout_done_at is not None
            or facts.workout_skipped_at is not None
        )
        workout = await self._workouts.load(user_id, on)
        exercise = burn_for_targets(workout, profile.weight_kg, settled=settled)
        return TodayView(
            date=on,
            flow=resolve_flow(facts),
            targets=compute_targets(profile, on, exercise),
            streak=streak_until(
                await self._days.recent_days(user_id, on, STREAK_WINDOW_DAYS), on
            ),
        )

    async def adjust(self, user_id: str, day: date, change: DayAdjustment) -> TodayView:
        if change.workout_done and change.workout_skipped:
            raise ValidationFailed("運動不能同時標記完成與跳過")
        state = "done" if change.workout_done else "skipped" if change.workout_skipped else None
        await self._days.update_day(
            user_id,
            day,
            workout_time=change.workout_time.value if change.workout_time else None,
            workout_state=state,
            workout_state_at=self._clock.now() if state else None,
        )
        return await self.view(user_id, day)

    async def set_meal_state(
        self, user_id: str, day: date, meal_time: MealTime, state: str
    ) -> TodayView:
        if meal_time not in PLANNED_SLOTS:
            raise ValidationFailed("額外餐點不需要標記已吃或跳過")
        if state not in {"eaten", "skipped", "planned"}:
            raise ValidationFailed("無效的餐點狀態")
        await self._days.set_meal_state(user_id, day, meal_time, state, self._clock.now())
        return await self.view(user_id, day)
