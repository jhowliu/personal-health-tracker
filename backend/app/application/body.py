"""Body tracking: record weight and waist, plus the chart series and weekly change."""

from datetime import date, timedelta

from app.application.ports import BodyStore, Clock
from app.domain.body_trend import summarize
from app.domain.errors import ValidationFailed
from app.domain.models import BodyLog, BodySummary

DEFAULT_WINDOW_DAYS = 30


class BodyTrackingService:
    def __init__(self, store: BodyStore, clock: Clock) -> None:
        self._store = store
        self._clock = clock

    async def record(self, user_id: str, log: BodyLog) -> None:
        if log.weight_kg is None and log.waist_cm is None:
            raise ValidationFailed("體重和腰圍至少要填一個")
        await self._store.upsert(user_id, log)

    async def remove(self, user_id: str, day: date) -> None:
        await self._store.delete(user_id, day)

    async def history(
        self, user_id: str, since: date | None, until: date | None, timezone: str
    ) -> tuple[BodyLog, ...]:
        end = until or self._clock.today(timezone)
        start = since or end - timedelta(days=DEFAULT_WINDOW_DAYS - 1)
        return await self._store.range(user_id, start, end)

    async def summary(
        self, user_id: str, since: date | None, until: date | None, timezone: str
    ) -> BodySummary:
        end = until or self._clock.today(timezone)
        start = since or end - timedelta(days=DEFAULT_WINDOW_DAYS - 1)
        logs = await self._store.range(user_id, start, end)
        return summarize(logs, end)
