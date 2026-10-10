"""The AI review of a week: how it went, and next week's plan for eating, training and the
body, written once.

The first time a week's report is read the model is asked and its answer kept, so opening
the report again, from the pop-up or from 進度, costs nothing.
"""

from datetime import date, timedelta

from app.application.ai_consent import AiConsentService
from app.application.daily_flow import DailyFlowService
from app.application.ports import (
    AccountStore,
    BodyStore,
    Clock,
    DayStore,
    ProgressStore,
    UnitOfWork,
    WeeklyAdvisor,
    WorkoutExecutionStore,
)
from app.application.progress import ProgressService
from app.domain.errors import NotFound, ValidationFailed
from app.domain.models import MealTime
from app.domain.progress import DayActivity, logged, week_bounds
from app.domain.weekly_advice import (
    DayDigest,
    WeekDigest,
    WeeklyAdvice,
    exercise_digest,
    meal_digest,
)

# Breakfast to dinner, then extras: the order the day is read in.
_MEAL_ORDER = list(MealTime)


class WeeklyAdviceService:
    def __init__(
        self,
        progress: ProgressService,
        store: ProgressStore,
        accounts: AccountStore,
        body: BodyStore,
        flow: DailyFlowService,
        days: DayStore,
        workouts: WorkoutExecutionStore,
        consent: AiConsentService,
        advisor: WeeklyAdvisor,
        clock: Clock,
        uow: UnitOfWork,
    ) -> None:
        self._progress = progress
        self._store = store
        self._accounts = accounts
        self._body = body
        self._flow = flow
        self._days = days
        self._workouts = workouts
        self._consent = consent
        self._advisor = advisor
        self._clock = clock
        self._uow = uow

    async def advice(self, user_id: str, day: date, timezone: str) -> WeeklyAdvice | None:
        """The review of the week `day` falls in, written now if it has none yet.

        None for a week with nothing logged. A week still under way is refused: its report
        is not out yet, and a review written now would miss the rest of it.
        """
        start, end = week_bounds(day)
        due, _ = await self._progress.due_week(user_id, self._clock.today(timezone))
        if start > due:
            raise ValidationFailed("這週還沒結束")
        kept = await self._store.advice(user_id, start)
        if kept is not None:
            return kept

        await self._consent.require(user_id)
        activity = await self._store.activity(user_id, start, end)
        if not any(logged(day) for day in activity):
            return None
        digest = await self._digest(user_id, start, activity, timezone)
        # Reading the days opens them, which writes. Commit before the model call so the
        # 10-30 s it takes does not hold SQLite's one write lock, everyone's.
        await self._uow.commit()

        advice = await self._advisor.advise(digest)
        await self._store.save_advice(user_id, start, advice, self._clock.now())
        return advice

    async def _digest(
        self, user_id: str, start: date, activity: tuple[DayActivity, ...], timezone: str
    ) -> WeekDigest:
        profile = await self._accounts.load_profile(user_id)
        if profile is None:
            raise NotFound("還沒有建立個人資料")
        end = start + timedelta(days=6)
        bodies = {log.date: log for log in await self._body.range(user_id, start, end)}
        known = {day.record.date: day for day in activity}

        days = []
        for offset in range(7):
            on = start + timedelta(days=offset)
            body = bodies.get(on)
            seen = known.get(on)
            targets = eaten = None
            meals: tuple = ()
            exercises: tuple = ()
            # Only days the user opened: opening one now would plan meals and a workout
            # into the past.
            if seen is not None and seen.opened:
                view = await self._flow.view(user_id, on)
                targets, eaten = view.targets, view.flow.eaten
                facts = await self._days.load_facts(user_id, on)
                meals = tuple(
                    sorted(
                        (m for m in map(meal_digest, facts.slots) if m is not None),
                        key=lambda meal: _MEAL_ORDER.index(meal.meal_time),
                    )
                )
                workout = await self._workouts.load(user_id, on)
                exercises = tuple(e for e in map(exercise_digest, workout.items) if e is not None)
            days.append(
                DayDigest(
                    date=on,
                    weight_kg=body.weight_kg if body else None,
                    waist_cm=body.waist_cm if body else None,
                    targets=targets,
                    eaten=eaten,
                    meals=meals,
                    workout=seen.workout if seen else None,
                    exercises=exercises,
                )
            )

        return WeekDigest(
            review=await self._progress.weekly(user_id, start, timezone),
            sex=profile.sex,
            age=profile.age_on(start),
            height_cm=profile.height_cm,
            activity_level=profile.activity_level,
            deficit_pct=profile.deficit_pct,
            days=tuple(days),
        )
