import aiosqlite

from app.domain.models import Food, FoodCategory, FoodState, Nutrients, SwapBasis

# Built-in rows carry a translation key; user-created ones carry a literal name.
_NAME = "COALESCE(f.name, t.text, f.name_key)"

_COLUMNS = f"""
    f.id, f.category_id, {_NAME} AS name, f.state,
    f.kcal_per_100g, f.protein_per_100g, f.fat_per_100g, f.carb_per_100g, f.fiber_per_100g,
    f.unit, f.grams_per_unit, f.usual_grams, f.max_grams,
    f.user_id IS NULL AS is_builtin
"""

_FROM = """
    FROM foods f
    LEFT JOIN translations t ON t.key = f.name_key AND t.locale = ?
"""

_VISIBLE = "(f.user_id IS NULL OR f.user_id = ?) AND f.archived_at IS NULL"


class SqliteFoodStore:
    def __init__(self, conn: aiosqlite.Connection, locale: str = "zh-TW") -> None:
        self._conn = conn
        self._locale = locale

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
        params: list[object] = [self._locale, user_id]

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
        return tuple([await self._with_aliases(row) for row in rows])

    async def load(self, user_id: str, food_id: str) -> Food | None:
        async with self._conn.execute(
            f"SELECT {_COLUMNS} {_FROM} WHERE f.id = ? AND {_VISIBLE}",
            (self._locale, food_id, user_id),
        ) as cursor:
            row = await cursor.fetchone()
        return await self._with_aliases(row) if row else None

    async def in_category(self, user_id: str, category_id: str) -> tuple[Food, ...]:
        return await self.search(user_id, None, category_id)

    async def save_custom(self, user_id: str, food: Food) -> None:
        await self._conn.execute(
            """
            INSERT INTO foods (
                id, user_id, category_id, name, state,
                kcal_per_100g, protein_per_100g, fat_per_100g, carb_per_100g, fiber_per_100g,
                unit, grams_per_unit, usual_grams, max_grams, source
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'user')
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

    async def archive_custom(self, user_id: str, food_id: str) -> None:
        await self._conn.execute(
            "UPDATE foods SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
            " WHERE id = ? AND user_id = ?",
            (food_id, user_id),
        )

    async def _with_aliases(self, row: aiosqlite.Row) -> Food:
        async with self._conn.execute(
            "SELECT alias FROM food_aliases WHERE food_id = ?", (row["id"],)
        ) as cursor:
            aliases = tuple(a["alias"] for a in await cursor.fetchall())

        return Food(
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
            aliases=aliases,
            is_builtin=bool(row["is_builtin"]),
        )
