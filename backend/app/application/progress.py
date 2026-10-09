"""Progress over time, read for the 進度 tab."""

import calendar
from datetime import date, timedelta

from app.application.ports import BodyStore, Clock, ProgressStore
from app.domain.progress import (
    CalendarDay,
    CalendarMonth,
    DayMark,
    WeeklyReview,
    mark_of,
    week_bounds,
    weekly_review,
)

# Far enough back that the latest waist before any week is found.
_EARLIEST = date(2000, 1, 1)


class ProgressService:
    def __init__(self, store: ProgressStore, body: BodyStore, clock: Clock) -> None:
        self._store = store
        self._body = body
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
        before = start - timedelta(days=7), start - timedelta(days=1)
        return weekly_review(
            start,
            await self._store.activity(user_id, start, end),
            await self._body.range(user_id, _EARLIEST, end),
            await self._store.volume_kg(user_id, start, end),
            await self._store.volume_kg(user_id, *before),
        )
