from datetime import date

import aiosqlite

from app.adapters.sqlite.rows import from_day, to_day
from app.domain.models import BodyLog


class SqliteBodyStore:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def upsert(self, user_id: str, log: BodyLog) -> None:
        await self._conn.execute(
            """
            INSERT INTO body_logs (user_id, date, weight_kg, waist_cm, updated_at)
            VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            ON CONFLICT (user_id, date) DO UPDATE SET
                weight_kg = COALESCE(excluded.weight_kg, body_logs.weight_kg),
                waist_cm  = COALESCE(excluded.waist_cm, body_logs.waist_cm),
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            """,
            (user_id, to_day(log.date), log.weight_kg, log.waist_cm),
        )

    async def delete(self, user_id: str, day: date) -> None:
        await self._conn.execute(
            "DELETE FROM body_logs WHERE user_id = ? AND date = ?", (user_id, to_day(day))
        )

    async def range(self, user_id: str, since: date, until: date) -> tuple[BodyLog, ...]:
        async with self._conn.execute(
            "SELECT date, weight_kg, waist_cm FROM body_logs"
            " WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date",
            (user_id, to_day(since), to_day(until)),
        ) as cursor:
            rows = await cursor.fetchall()
        return tuple(
            BodyLog(
                date=from_day(row["date"]),
                weight_kg=row["weight_kg"],
                waist_cm=row["waist_cm"],
            )
            for row in rows
        )
