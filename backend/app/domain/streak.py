"""The streak: consecutive complete days, counted back from a given date."""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta

from app.domain.models import PLANNED_SLOTS

# How many days back a store is asked to look; a streak cannot be longer than this.
STREAK_WINDOW_DAYS = 400


@dataclass(frozen=True, slots=True)
class DayRecord:
    """What was logged on one Day, as far as the streak cares."""

    date: date
    body_logged: bool
    meals_resolved: int  # planned meal slots marked eaten or skipped

    @property
    def complete(self) -> bool:
        return self.body_logged and self.meals_resolved == len(PLANNED_SLOTS)


def streak_until(records: Iterable[DayRecord], day: date) -> int:
    """Complete days in a row ending on `day`, or on the day before while `day` is unfinished.

    Today only counts once it is complete, but being unfinished does not break the streak:
    the count so far stands until the day is over.
    """
    complete = {record.date for record in records if record.complete}
    if day not in complete:
        day -= timedelta(days=1)
    count = 0
    while day in complete:
        count += 1
        day -= timedelta(days=1)
    return count
