import aiosqlite

from app.adapters.sqlite.foods import SqliteFoodStore
from app.domain.models import Meal, MealItem, MealTag, MealTime


class SqliteMealStore:
    def __init__(self, conn: aiosqlite.Connection, locale: str = "zh-TW") -> None:
        self._conn = conn
        self._foods = SqliteFoodStore(conn, locale)

    async def list(
        self, user_id: str, meal_time: MealTime | None, query: str | None
    ) -> tuple[Meal, ...]:
        clauses = ["m.user_id = ?", "m.archived_at IS NULL"]
        params: list[object] = [user_id]

        if meal_time:
            clauses.append(
                "EXISTS (SELECT 1 FROM meal_times mt"
                "        WHERE mt.meal_id = m.id AND mt.meal_time = ?)"
            )
            params.append(meal_time.value)
        if query:
            clauses.append("m.name LIKE ?")
            params.append(f"%{query}%")

        async with self._conn.execute(
            f"SELECT m.id, m.name, m.tag FROM meals m WHERE {' AND '.join(clauses)}"
            " ORDER BY m.created_at",
            params,
        ) as cursor:
            rows = await cursor.fetchall()

        return tuple([await self._hydrate(user_id, row) for row in rows])

    async def load(self, user_id: str, meal_id: str) -> Meal | None:
        async with self._conn.execute(
            "SELECT id, name, tag FROM meals"
            " WHERE id = ? AND user_id = ? AND archived_at IS NULL",
            (meal_id, user_id),
        ) as cursor:
            row = await cursor.fetchone()
        return await self._hydrate(user_id, row) if row else None

    async def save(self, user_id: str, meal: Meal) -> None:
        await self._conn.execute(
            """
            INSERT INTO meals (id, user_id, name, tag) VALUES (?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                name = excluded.name,
                tag = excluded.tag,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE meals.user_id = excluded.user_id
            """,
            (meal.id, user_id, meal.name, meal.tag.value),
        )

        # Slots and items are replaced wholesale — simpler than diffing, and the meal
        # editor always sends the complete set.
        await self._conn.execute("DELETE FROM meal_times WHERE meal_id = ?", (meal.id,))
        await self._conn.executemany(
            "INSERT INTO meal_times (meal_id, meal_time) VALUES (?, ?)",
            [(meal.id, slot.value) for slot in sorted(meal.meal_times)],
        )

        await self._conn.execute("DELETE FROM meal_items WHERE meal_id = ?", (meal.id,))
        await self._conn.executemany(
            "INSERT INTO meal_items (id, meal_id, food_id, grams, sort_order)"
            " VALUES (?, ?, ?, ?, ?)",
            [
                (item.id, meal.id, item.food.id, item.grams, index)
                for index, item in enumerate(meal.items)
            ],
        )

    async def archive(self, user_id: str, meal_id: str) -> None:
        await self._conn.execute(
            "UPDATE meals SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
            " WHERE id = ? AND user_id = ?",
            (meal_id, user_id),
        )

    async def _hydrate(self, user_id: str, row: aiosqlite.Row) -> Meal:
        async with self._conn.execute(
            "SELECT meal_time FROM meal_times WHERE meal_id = ?", (row["id"],)
        ) as cursor:
            slots = frozenset(MealTime(r["meal_time"]) for r in await cursor.fetchall())

        async with self._conn.execute(
            "SELECT id, food_id, grams, sort_order FROM meal_items"
            " WHERE meal_id = ? ORDER BY sort_order",
            (row["id"],),
        ) as cursor:
            item_rows = await cursor.fetchall()

        items = []
        for item_row in item_rows:
            food = await self._foods.load(user_id, item_row["food_id"])
            if food is None:
                # The food was archived out from under the meal; drop it rather than
                # failing the whole meal.
                continue
            items.append(
                MealItem(
                    id=item_row["id"],
                    food=food,
                    grams=item_row["grams"],
                    sort_order=item_row["sort_order"],
                )
            )

        return Meal(
            id=row["id"],
            name=row["name"],
            tag=MealTag(row["tag"]),
            meal_times=slots,
            items=tuple(items),
        )
