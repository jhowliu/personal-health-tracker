from datetime import datetime
from zoneinfo import ZoneInfo

import aiosqlite

from app.adapters.sqlite.rows import to_iso
from app.application.ports import DueReminder
from app.domain.ids import new_id


class SqliteReminderStore:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def register_device(
        self, user_id: str, push_token: str, platform: str, seen_at: datetime
    ) -> None:
        await self._conn.execute(
            """
            INSERT INTO devices (id, user_id, push_token, platform, last_seen_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (push_token) DO UPDATE SET
                user_id = excluded.user_id,
                platform = excluded.platform,
                last_seen_at = excluded.last_seen_at
            """,
            (new_id(), user_id, push_token, platform, to_iso(seen_at)),
        )

    async def due_at(self, now: datetime) -> tuple[DueReminder, ...]:
        """提醒時間是各自時區的牆上時間,所以撈出有設定的人後在 Python 比對。"""
        async with self._conn.execute(
            """
            SELECT p.user_id, p.reminder_time, p.timezone, u.locale,
                   GROUP_CONCAT(d.push_token) AS tokens
            FROM profiles p
            JOIN users u ON u.id = p.user_id
            JOIN devices d ON d.user_id = p.user_id
            WHERE p.reminder_time IS NOT NULL
            GROUP BY p.user_id, p.reminder_time, p.timezone, u.locale
            """
        ) as cursor:
            rows = await cursor.fetchall()

        due: list[DueReminder] = []
        for row in rows:
            local = now.astimezone(ZoneInfo(row["timezone"]))
            if local.strftime("%H:%M") != row["reminder_time"]:
                continue
            if await self._already_logged(row["user_id"], local.date().isoformat()):
                continue
            due.append(
                DueReminder(
                    user_id=row["user_id"],
                    push_tokens=tuple(row["tokens"].split(",")),
                    locale=row["locale"],
                )
            )
        return tuple(due)

    async def _already_logged(self, user_id: str, day: str) -> bool:
        async with self._conn.execute(
            "SELECT 1 FROM body_logs WHERE user_id = ? AND date = ?", (user_id, day)
        ) as cursor:
            return await cursor.fetchone() is not None
