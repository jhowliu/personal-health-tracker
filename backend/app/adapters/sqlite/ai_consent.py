from datetime import datetime

import aiosqlite

from app.adapters.sqlite.rows import from_iso, to_iso


class SqliteAiConsentStore:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def consented_at(self, user_id: str) -> datetime | None:
        async with self._conn.execute(
            "SELECT ai_consent_at FROM users WHERE id = ?", (user_id,)
        ) as cursor:
            row = await cursor.fetchone()
        return from_iso(row["ai_consent_at"]) if row else None

    async def set_consent(self, user_id: str, at: datetime | None) -> None:
        await self._conn.execute(
            "UPDATE users SET ai_consent_at = ? WHERE id = ?",
            (to_iso(at) if at else None, user_id),
        )
