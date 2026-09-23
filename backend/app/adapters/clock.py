from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)

    def today(self, timezone: str) -> date:
        return datetime.now(ZoneInfo(timezone)).date()
