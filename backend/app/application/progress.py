"""Progress over time, read for the 進度 tab."""

import calendar
from datetime import date, timedelta

from app.application.ports import BodyStore, Clock, DayStore, ProgressStore
from app.domain.daily_flow import resolve_flow
from app.domain.models import FlowStep
from app.domain.progress import (
    CalendarDay,
    CalendarMonth,
    DayActivity,
    DayMark,
    WeeklyReview,
    WeekSummary,
    WeekVolume,
    logged,
    mark_of,
    past_weeks,
    week_bounds,
    weekly_review,
    weekly_volumes,
)

# Far enough back that the latest waist before any week is found.
_EARLIEST = date(2000, 1, 1)


class ProgressService:
    def __init__(self, store: ProgressStore, body: BodyStore, days: DayStore, clock: Clock) -> None:
        self._store = store
        self._body = body
        self._days = days
        self._clock = clock

    async def calendar(self, user_id: str, month: date | None, timezone: str) -> CalendarMonth:
        """Every day of `month` (this month when None), marked by what was logged."""
        today = self._clock.today(timezone)
        first = (month or today).replace(day=1)
        last = first.replace(day=calendar.monthrange(first.year, first.month)[1])
        logged = {
            activity.record.date: activity
            for activity in await self._store.activity(user_id, first, last)
        }
        days = []
        day = first
        while day <= last:
            activity = logged.get(day)
            days.append(
                CalendarDay(
                    date=day,
                    mark=mark_of(activity.record) if activity else DayMark.EMPTY,
                    workout=activity.workout if activity else None,
                )
            )
            day += timedelta(days=1)
        return CalendarMonth(month=first, today=today, days=tuple(days))

    async def weekly(self, user_id: str, day: date | None, timezone: str) -> WeeklyReview:
        """The week `day` falls in; without one, the last week that has ended."""
        start, end = week_bounds(day or self._clock.today(timezone) - timedelta(days=7))
        return await self._review(user_id, start, await self._store.activity(user_id, start, end))

    async def pending(self, user_id: str, timezone: str) -> WeeklyReview | None:
        """The week whose report should pop up now, or None once it was shown or held nothing.

        That is the last week that has ended, or this week on a Sunday whose flow is done, since
        nothing more is coming for it.
        """
        start, end = await self.due_week(user_id, self._clock.today(timezone))
        if start in await self._store.seen_weeks(user_id):
            return None
        activity = await self._store.activity(user_id, start, end)
        if not any(logged(day) for day in activity):
            return None
        return await self._review(user_id, start, activity)

    async def mark_seen(self, user_id: str, day: date) -> None:
        """The report of the week `day` falls in was shown; it does not pop up again."""
        await self._store.mark_week_seen(user_id, week_bounds(day)[0])

    async def weeks(self, user_id: str, timezone: str) -> tuple[WeekSummary, ...]:
        """Every week with a report to read, newest first: the ones that have ended, and this
        one once a finished Sunday made it due."""
        today = self._clock.today(timezone)
        this_week, end = week_bounds(today)
        due, _ = await self.due_week(user_id, today)
        return past_weeks(
            await self._store.activity(user_id, _EARLIEST, end),
            this_week,
            await self._store.seen_weeks(user_id) | {due},
        )

    async def volume_trend(
        self, user_id: str, timezone: str, weeks: int
    ) -> tuple[date, tuple[WeekVolume, ...]]:
        """This week's Monday, and the training volume of the `weeks` weeks up to it."""
        this_week, end = week_bounds(self._clock.today(timezone))
        first = this_week - timedelta(weeks=weeks - 1)
        daily = await self._store.daily_volume_kg(user_id, first, end)
        return this_week, weekly_volumes(daily, this_week, weeks)

    async def due_week(self, user_id: str, today: date) -> tuple[date, date]:
        """The last week that has ended, or this one on a Sunday whose flow is done."""
        # Loading the facts opens the day, so only a Sunday looks.
        finished_sunday = (
            today.weekday() == 6
            and resolve_flow(await self._days.load_facts(user_id, today)).current is FlowStep.DONE
        )
        return week_bounds(today if finished_sunday else today - timedelta(days=7))

    async def _review(
        self, user_id: str, start: date, activity: tuple[DayActivity, ...]
    ) -> WeeklyReview:
        end = start + timedelta(days=6)
        before = start - timedelta(days=7), start - timedelta(days=1)
        return weekly_review(
            start,
            activity,
            await self._body.range(user_id, _EARLIEST, end),
            await self._store.volume_kg(user_id, start, end),
            await self._store.volume_kg(user_id, *before),
        )
