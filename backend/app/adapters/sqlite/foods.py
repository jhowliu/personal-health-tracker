from datetime import date

import aiosqlite

from app.domain.models import Food, FoodCategory, FoodState, Nutrients, SwapBasis

_NAME = "f.name"

_COLUMNS = f"""
    f.id, f.category_id, {_NAME} AS name, f.state,
    f.kcal_per_100g, f.protein_per_100g, f.fat_per_100g, f.carb_per_100g, f.fiber_per_100g,
    f.unit, f.grams_per_unit, f.usual_grams, f.max_grams,
    f.template_id
"""

_FROM = "FROM foods f"
_VISIBLE = "f.user_id = ? AND f.archived_at IS NULL"


class SqliteFoodStore:
    def __init__(self, conn: aiosqlite.Connection, locale: str = "zh-TW") -> None:
        self._conn = conn
        self._locale = locale

    async def seed_defaults(self, user_id: str) -> None:
        """Copy only missing defaults. Archived copies keep their template key and stay hidden.

        The per-user id is derived from the template id, so running this again is a no-op.
        """
        async with self._conn.execute(
            """
            INSERT INTO foods (
                id, user_id, template_id, category_id, name, state, kcal_per_100g,
                protein_per_100g, fat_per_100g, carb_per_100g, fiber_per_100g,
                unit, grams_per_unit, usual_grams, max_grams
            )
            SELECT 'seed:' || ? || ':' || t.id, ?, t.id, t.category_id, t.name, t.state,
                   t.kcal_per_100g, t.protein_per_100g, t.fat_per_100g, t.carb_per_100g,
                   t.fiber_per_100g, t.unit, t.grams_per_unit, t.usual_grams, t.max_grams
            FROM food_templates t WHERE t.retired_at IS NULL
            ON CONFLICT DO NOTHING
            RETURNING id
            """,
            (user_id, user_id),
        ) as cursor:
            inserted = [row["id"] for row in await cursor.fetchall()]
        if not inserted:
            return
        placeholders = ", ".join("?" for _ in inserted)
        await self._conn.execute(
            f"""
            INSERT OR IGNORE INTO food_aliases (food_id, alias)
            SELECT f.id, a.value
            FROM foods f JOIN food_templates t ON t.id = f.template_id,
                 json_each(t.aliases_json) a
            WHERE f.user_id = ? AND f.id IN ({placeholders})
            """,
            (user_id, *inserted),
        )

    async def categories(self) -> tuple[FoodCategory, ...]:
        async with self._conn.execute(
            """
            SELECT c.id, COALESCE(t.text, c.name_key) AS name, c.swap_by, c.sort_order
            FROM food_categories c
            LEFT JOIN translations t ON t.key = c.name_key AND t.locale = ?
            ORDER BY c.sort_order
            """,
            (self._locale,),
        ) as cursor:
            rows = await cursor.fetchall()
        return tuple(
            FoodCategory(
                id=row["id"],
                name=row["name"],
                swap_by=SwapBasis(row["swap_by"]),
                sort_order=row["sort_order"],
            )
            for row in rows
        )

    async def search(
        self, user_id: str, query: str | None, category_id: str | None
    ) -> tuple[Food, ...]:
        clauses = [_VISIBLE]
        params: list[object] = [user_id]

        if category_id:
            clauses.append("f.category_id = ?")
            params.append(category_id)
        if query:
            # Aliases are how "雞腿" finds "去骨雞腿(帶皮、熟)".
            clauses.append(
                f"({_NAME} LIKE ? OR EXISTS ("
                "  SELECT 1 FROM food_aliases a WHERE a.food_id = f.id AND a.alias LIKE ?))"
            )
            params += [f"%{query}%", f"%{query}%"]

        async with self._conn.execute(
            f"SELECT {_COLUMNS} {_FROM} WHERE {' AND '.join(clauses)}"
            " ORDER BY f.category_id, name",
            params,
        ) as cursor:
            rows = await cursor.fetchall()
        return await self._foods(rows)

    async def load(self, user_id: str, food_id: str) -> Food | None:
        async with self._conn.execute(
            f"SELECT {_COLUMNS} {_FROM} WHERE f.id = ? AND {_VISIBLE}",
            (food_id, user_id),
        ) as cursor:
            row = await cursor.fetchone()
        return (await self._foods([row]))[0] if row else None

    async def load_referenced(self, user_id: str, food_id: str) -> Food | None:
        """Existing meals and day snapshots retain foods archived from the picker."""
        async with self._conn.execute(
            f"SELECT {_COLUMNS} {_FROM} WHERE f.id = ? AND f.user_id = ?",
            (food_id, user_id),
        ) as cursor:
            row = await cursor.fetchone()
        return (await self._foods([row]))[0] if row else None

    async def in_category(self, user_id: str, category_id: str) -> tuple[Food, ...]:
        return await self.search(user_id, None, category_id)

    async def recently_logged(self, user_id: str, since: date) -> tuple[str, ...]:
        async with self._conn.execute(
            "SELECT food_id FROM day_meal_items"
            " WHERE user_id = ? AND date >= ? AND food_id IS NOT NULL"
            " GROUP BY food_id ORDER BY MAX(date) DESC, MAX(created_at) DESC",
            (user_id, since.isoformat()),
        ) as cursor:
            return tuple(row[0] for row in await cursor.fetchall())

    async def save(self, user_id: str, food: Food) -> None:
        await self._conn.execute(
            """
            INSERT INTO foods (
                id, user_id, category_id, name, state,
                kcal_per_100g, protein_per_100g, fat_per_100g, carb_per_100g, fiber_per_100g,
                unit, grams_per_unit, usual_grams, max_grams
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                category_id = excluded.category_id,
                name = excluded.name,
                state = excluded.state,
                kcal_per_100g = excluded.kcal_per_100g,
                protein_per_100g = excluded.protein_per_100g,
                fat_per_100g = excluded.fat_per_100g,
                carb_per_100g = excluded.carb_per_100g,
                fiber_per_100g = excluded.fiber_per_100g,
                unit = excluded.unit,
                grams_per_unit = excluded.grams_per_unit,
                usual_grams = excluded.usual_grams,
                max_grams = excluded.max_grams,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE foods.user_id = excluded.user_id
            """,
            (
                food.id,
                user_id,
                food.category_id,
                food.name,
                food.state.value,
                food.per_100g.kcal,
                food.per_100g.protein_g,
                food.per_100g.fat_g,
                food.per_100g.carb_g,
                food.fiber_per_100g,
                food.unit,
                food.grams_per_unit,
                food.usual_grams,
                food.max_grams,
            ),
        )

    async def archive(self, user_id: str, food_id: str) -> None:
        await self._conn.execute(
            "UPDATE foods SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
            " WHERE id = ? AND user_id = ?",
            (food_id, user_id),
        )

    async def _foods(self, rows: list[aiosqlite.Row]) -> tuple[Food, ...]:
        """Build Foods from rows, fetching every food's aliases in one query."""
        if not rows:
            return ()
        placeholders = ", ".join("?" for _ in rows)
        async with self._conn.execute(
            f"SELECT food_id, alias FROM food_aliases WHERE food_id IN ({placeholders})",
            [row["id"] for row in rows],
        ) as cursor:
            aliases: dict[str, list[str]] = {}
            for alias in await cursor.fetchall():
                aliases.setdefault(alias["food_id"], []).append(alias["alias"])

        return tuple(
            Food(
                id=row["id"],
                category_id=row["category_id"],
                name=row["name"],
                state=FoodState(row["state"]),
                per_100g=Nutrients(
                    kcal=row["kcal_per_100g"],
                    protein_g=row["protein_per_100g"],
                    fat_g=row["fat_per_100g"],
                    carb_g=row["carb_per_100g"],
                ),
                fiber_per_100g=row["fiber_per_100g"],
                unit=row["unit"],
                grams_per_unit=row["grams_per_unit"],
                usual_grams=row["usual_grams"],
                max_grams=row["max_grams"],
                aliases=tuple(aliases.get(row["id"], ())),
                template_id=row["template_id"],
            )
            for row in rows
        )
