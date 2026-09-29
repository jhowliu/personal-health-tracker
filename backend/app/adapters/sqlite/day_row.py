"""Opening a Day: the one place that knows what a Day needs to exist."""

from datetime import date

import aiosqlite

from app.adapters.sqlite.rows import to_day
from app.domain.errors import NotFound
from app.domain.models import PLANNED_SLOTS

PLANNED_MEALS = tuple(slot.value for slot in PLANNED_SLOTS)


async def open_day(conn: aiosqlite.Connection, user_id: str, day: date) -> None:
    """Materialise the user's Day: its row, its scheduled workout and its meal slots.

    Idempotent, and safe to call at the start of every read or write. The row copies the
    profile's workout time the first time the day is opened.
    """
    await conn.execute(
        "INSERT INTO days (user_id, date, workout_time)"
        " SELECT user_id, ?, workout_time FROM profiles WHERE user_id = ?"
        " ON CONFLICT (user_id, date) DO NOTHING",
        (to_day(day), user_id),
    )
    async with conn.execute(
        "SELECT 1 FROM days WHERE user_id = ? AND date = ?", (user_id, to_day(day))
    ) as cursor:
        if await cursor.fetchone() is None:
            raise NotFound("還沒有建立個人資料")

    # The schedule may have been set after the day was opened, so backfill on every call.
    await conn.execute(
        """
        UPDATE days SET template_id = (
            SELECT ws.template_id FROM workout_schedule ws
            WHERE ws.user_id = days.user_id AND ws.weekday = ?
        )
        WHERE user_id = ? AND date = ? AND template_id IS NULL
        """,
        (day.weekday(), user_id, to_day(day)),
    )
    await conn.executemany(
        "INSERT INTO day_meals (user_id, date, meal_time) VALUES (?, ?, ?)"
        " ON CONFLICT (user_id, date, meal_time) DO NOTHING",
        [(user_id, to_day(day), meal_time) for meal_time in PLANNED_MEALS],
    )
