import json
from dataclasses import asdict
from datetime import date, datetime

import aiosqlite

from app.adapters.sqlite.day_row import PLANNED_MEALS
from app.adapters.sqlite.rows import from_day, to_day, to_iso
from app.domain.progress import DayActivity, WorkoutMark
from app.domain.streak import DayRecord
from app.domain.weekly_advice import WeeklyAdvice


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
                   d.workout_done_at, d.workout_skipped_at, d.date IS NOT NULL AS opened
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
                opened=bool(row["opened"]),
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

    async def daily_volume_kg(self, user_id: str, first: date, last: date) -> dict[date, float]:
        async with self._conn.execute(
            "SELECT date, SUM(weight_kg * reps_done) AS volume FROM set_logs"
            " WHERE user_id = ? AND date BETWEEN ? AND ?"
            " AND weight_kg IS NOT NULL AND reps_done IS NOT NULL"
            " GROUP BY date",
            (user_id, to_day(first), to_day(last)),
        ) as cursor:
            rows = await cursor.fetchall()
        return {from_day(row["date"]): float(row["volume"]) for row in rows}

    async def seen_weeks(self, user_id: str) -> frozenset[date]:
        async with self._conn.execute(
            "SELECT week_start FROM weekly_reports WHERE user_id = ? AND seen_at IS NOT NULL",
            (user_id,),
        ) as cursor:
            rows = await cursor.fetchall()
        return frozenset(from_day(row["week_start"]) for row in rows)

    async def mark_week_seen(self, user_id: str, start: date) -> None:
        await self._conn.execute(
            """
            INSERT INTO weekly_reports (user_id, week_start, seen_at)
            VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            ON CONFLICT (user_id, week_start) DO UPDATE SET
                seen_at = COALESCE(weekly_reports.seen_at, excluded.seen_at)
            """,
            (user_id, to_day(start)),
        )

    async def advice(self, user_id: str, start: date) -> WeeklyAdvice | None:
        async with self._conn.execute(
            "SELECT advice FROM weekly_reports WHERE user_id = ? AND week_start = ?",
            (user_id, to_day(start)),
        ) as cursor:
            row = await cursor.fetchone()
        return WeeklyAdvice(**json.loads(row["advice"])) if row and row["advice"] else None

    async def save_advice(
        self, user_id: str, start: date, advice: WeeklyAdvice, at: datetime
    ) -> None:
        await self._conn.execute(
            """
            INSERT INTO weekly_reports (user_id, week_start, advice, advice_at) VALUES (?, ?, ?, ?)
            ON CONFLICT (user_id, week_start) DO UPDATE SET
                advice = excluded.advice, advice_at = excluded.advice_at
            """,
            (
                user_id,
                to_day(start),
                json.dumps(asdict(advice), ensure_ascii=False),
                to_iso(at),
            ),
        )
