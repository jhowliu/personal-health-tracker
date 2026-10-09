from datetime import date

import aiosqlite

from app.adapters.sqlite.day_row import PLANNED_MEALS
from app.adapters.sqlite.rows import from_day, to_day
from app.domain.progress import DayActivity, WorkoutMark
from app.domain.streak import DayRecord


class SqliteProgressStore:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def activity(self, user_id: str, first: date, last: date) -> tuple[DayActivity, ...]:
        # A weigh-in can be saved for a day never opened, so dates come from both tables.
        async with self._conn.execute(
            f"""
            WITH dates AS (
                SELECT date FROM days WHERE user_id = ? AND date BETWEEN ? AND ?
                UNION
                SELECT date FROM body_logs WHERE user_id = ? AND date BETWEEN ? AND ?
            )
            SELECT dates.date,
                   EXISTS (SELECT 1 FROM body_logs b
                           WHERE b.user_id = ? AND b.date = dates.date) AS body_logged,
                   (SELECT COUNT(*) FROM day_meals m
                    WHERE m.user_id = ? AND m.date = dates.date
                      AND m.meal_time IN {PLANNED_MEALS}
                      AND (m.eaten_at IS NOT NULL OR m.skipped_at IS NOT NULL)) AS meals_resolved,
                   d.workout_done_at, d.workout_skipped_at
            FROM dates
            LEFT JOIN days d ON d.user_id = ? AND d.date = dates.date
            ORDER BY dates.date
            """,
            (
                user_id, to_day(first), to_day(last),
                user_id, to_day(first), to_day(last),
                user_id, user_id, user_id,
            ),
        ) as cursor:
            rows = await cursor.fetchall()
        return tuple(
            DayActivity(
                record=DayRecord(
                    from_day(row["date"]), bool(row["body_logged"]), row["meals_resolved"]
                ),
                workout=(
                    WorkoutMark.DONE
                    if row["workout_done_at"]
                    else WorkoutMark.SKIPPED
                    if row["workout_skipped_at"]
                    else None
                ),
            )
            for row in rows
        )

    async def volume_kg(self, user_id: str, first: date, last: date) -> float:
        async with self._conn.execute(
            "SELECT COALESCE(SUM(weight_kg * reps_done), 0) AS volume FROM set_logs"
            " WHERE user_id = ? AND date BETWEEN ? AND ?"
            " AND weight_kg IS NOT NULL AND reps_done IS NOT NULL",
            (user_id, to_day(first), to_day(last)),
        ) as cursor:
            row = await cursor.fetchone()
        return float(row["volume"])
