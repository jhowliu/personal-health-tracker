from datetime import datetime

import aiosqlite

from app.adapters.sqlite.rows import to_day, to_iso, to_profile
from app.application.ports import Credentials
from app.domain.ids import new_id
from app.domain.models import Account, Profile


class SqliteAccountStore:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def create_account(self, account: Account, password_hash: str | None) -> None:
        await self._conn.execute(
            "INSERT INTO users (id, email, password_hash, locale, created_at)"
            " VALUES (?, ?, ?, ?, ?)",
            (
                account.id,
                account.email,
                password_hash,
                account.locale,
                to_iso(account.created_at),
            ),
        )

    async def find_credentials(self, email: str) -> Credentials | None:
        async with self._conn.execute(
            "SELECT id, email, password_hash FROM users WHERE email = ?", (email,)
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            return None
        return Credentials(
            user_id=row["id"], email=row["email"], password_hash=row["password_hash"]
        )

    async def find_by_identity(self, provider: str, subject: str) -> str | None:
        async with self._conn.execute(
            "SELECT user_id FROM user_identities WHERE provider = ? AND provider_subject = ?",
            (provider, subject),
        ) as cursor:
            row = await cursor.fetchone()
        return row["user_id"] if row else None

    async def link_identity(
        self, provider: str, subject: str, user_id: str, email: str | None
    ) -> None:
        await self._conn.execute(
            "INSERT INTO user_identities (provider, provider_subject, user_id, email)"
            " VALUES (?, ?, ?, ?)"
            " ON CONFLICT (provider, provider_subject) DO UPDATE SET user_id = excluded.user_id",
            (provider, subject, user_id, email),
        )

    async def delete_account(self, user_id: str) -> None:
        await self._conn.execute("DELETE FROM users WHERE id = ?", (user_id,))

    async def save_refresh(self, user_id: str, token_hash: str, expires_at: datetime) -> None:
        await self._conn.execute(
            "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)"
            " VALUES (?, ?, ?, ?)",
            (new_id(), user_id, token_hash, to_iso(expires_at)),
        )

    async def consume_refresh(self, token_hash: str, now: datetime) -> str | None:
        async with self._conn.execute(
            "UPDATE refresh_tokens SET revoked_at = ?"
            " WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?"
            " RETURNING user_id",
            (to_iso(now), token_hash, to_iso(now)),
        ) as cursor:
            row = await cursor.fetchone()
        return row["user_id"] if row else None

    async def revoke_all_refresh(self, user_id: str) -> None:
        await self._conn.execute(
            "UPDATE refresh_tokens SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
            " WHERE user_id = ? AND revoked_at IS NULL",
            (user_id,),
        )

    async def load_profile(self, user_id: str) -> Profile | None:
        async with self._conn.execute(
            "SELECT * FROM profiles WHERE user_id = ?", (user_id,)
        ) as cursor:
            row = await cursor.fetchone()
        return to_profile(row) if row else None

    async def save_profile(self, profile: Profile) -> None:
        await self._conn.execute(
            """
            INSERT INTO profiles (
                user_id, sex, birth_date, height_cm, weight_kg, activity_level, deficit_pct,
                carb_base_g, auto_scale_carbs, auto_assign_meals, workout_time,
                default_location, reminder_time, timezone,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                      strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            ON CONFLICT (user_id) DO UPDATE SET
                sex = excluded.sex,
                birth_date = excluded.birth_date,
                height_cm = excluded.height_cm,
                weight_kg = excluded.weight_kg,
                activity_level = excluded.activity_level,
                deficit_pct = excluded.deficit_pct,
                carb_base_g = excluded.carb_base_g,
                auto_scale_carbs = excluded.auto_scale_carbs,
                auto_assign_meals = excluded.auto_assign_meals,
                workout_time = excluded.workout_time,
                default_location = excluded.default_location,
                reminder_time = excluded.reminder_time,
                timezone = excluded.timezone,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            """,
            (
                profile.user_id,
                profile.sex.value,
                to_day(profile.birth_date),
                profile.height_cm,
                profile.weight_kg,
                profile.activity_level.value,
                profile.deficit_pct,
                profile.carb_base_g,
                int(profile.auto_scale_carbs),
                int(profile.auto_assign_meals),
                profile.workout_time.value,
                profile.default_location.value,
                profile.reminder_time,
                profile.timezone,
            ),
        )
