import aiosqlite

from app.adapters.sqlite.rows import from_iso, to_day, to_iso
from app.domain.meal_photos import MealPhoto, MealPhotoStatus


class SqliteMealPhotoStore:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def create(self, photo: MealPhoto) -> None:
        await self._conn.execute(
            "INSERT INTO meal_photos (id, user_id, object_key, status, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (
                photo.id,
                photo.user_id,
                photo.object_key,
                photo.status.value,
                to_iso(photo.created_at),
            ),
        )

    async def load(self, user_id: str, photo_id: str) -> MealPhoto | None:
        async with self._conn.execute(
            "SELECT id, user_id, object_key, status, result_json, created_at, analyzed_at "
            "FROM meal_photos WHERE id = ? AND user_id = ?",
            (photo_id, user_id),
        ) as cursor:
            row = await cursor.fetchone()
        return self._photo(row) if row else None

    async def begin_analysis(self, user_id: str, photo_id: str, now) -> MealPhoto | None:
        await self._conn.execute(
            "UPDATE meal_photos SET status = ?, analyzed_at = ?, result_json = NULL "
            "WHERE id = ? AND user_id = ? AND status = ?",
            (
                MealPhotoStatus.ANALYZING.value,
                to_iso(now),
                photo_id,
                user_id,
                MealPhotoStatus.UPLOADED.value,
            ),
        )
        return await self.load(user_id, photo_id)

    async def finish_analysis(
        self, user_id: str, photo_id: str, status: str, result_json: str
    ) -> None:
        await self._conn.execute(
            "UPDATE meal_photos SET status = ?, result_json = ? WHERE id = ? AND user_id = ?",
            (status, result_json, photo_id, user_id),
        )

    async def analyses_on(self, user_id: str, day) -> int:
        async with self._conn.execute(
            "SELECT COUNT(*) AS count FROM meal_photos "
            "WHERE user_id = ? AND analyzed_at IS NOT NULL AND date(analyzed_at) = ?",
            (user_id, to_day(day)),
        ) as cursor:
            return (await cursor.fetchone())["count"]

    @staticmethod
    def _photo(row: aiosqlite.Row) -> MealPhoto:
        return MealPhoto(
            id=row["id"],
            user_id=row["user_id"],
            object_key=row["object_key"],
            status=MealPhotoStatus(row["status"]),
            result_json=row["result_json"],
            created_at=from_iso(row["created_at"]),
            analyzed_at=from_iso(row["analyzed_at"]),
        )
