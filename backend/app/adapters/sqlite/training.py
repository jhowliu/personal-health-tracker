import aiosqlite

from app.domain.ids import new_id
from app.domain.models import Exercise, ScheduleEntry, TemplateItem, WorkoutTemplate

_EXERCISE_NAME = "COALESCE(e.name, t.text, e.name_key)"
_EXERCISE_COLUMNS = f"""
    e.id, e.category_id, {_EXERCISE_NAME} AS name,
    COALESCE(e.description, td.text) AS description,
    e.body_region, e.equipment, e.location, e.met, e.user_id IS NULL AS is_builtin
"""
_EXERCISE_FROM = """
    FROM exercises e
    LEFT JOIN translations t ON t.key = e.name_key AND t.locale = ?
    LEFT JOIN translations td ON td.key = e.description_key AND td.locale = ?
"""
_EXERCISE_VISIBLE = "(e.user_id IS NULL OR e.user_id = ?) AND e.archived_at IS NULL"


class SqliteTrainingStore:
    def __init__(self, conn: aiosqlite.Connection, locale: str = "zh-TW") -> None:
        self._conn = conn
        self._locale = locale

    async def search_exercises(
        self,
        user_id: str,
        *,
        query: str | None,
        category_id: str | None,
        body_region: str | None,
        equipment: str | None,
    ) -> tuple[Exercise, ...]:
        clauses = [_EXERCISE_VISIBLE]
        params: list[object] = [self._locale, self._locale, user_id]
        if category_id:
            clauses.append("e.category_id = ?")
            params.append(category_id)
        if body_region:
            clauses.append("e.body_region = ?")
            params.append(body_region)
        if equipment:
            clauses.append("e.equipment = ?")
            params.append(equipment)
        if query:
            clauses.append(
                "(e.name LIKE ? OR EXISTS ("
                "SELECT 1 FROM translations names "
                "WHERE names.key = e.name_key AND names.text LIKE ?))"
            )
            params.extend((f"%{query}%", f"%{query}%"))

        async with self._conn.execute(
            f"""
            SELECT {_EXERCISE_COLUMNS} {_EXERCISE_FROM}
            WHERE {" AND ".join(clauses)}
            ORDER BY e.category_id, name
            """,
            params,
        ) as cursor:
            rows = await cursor.fetchall()
        return tuple(self._exercise(row) for row in rows)

    async def load_exercise(self, user_id: str, exercise_id: str) -> Exercise | None:
        async with self._conn.execute(
            f"SELECT {_EXERCISE_COLUMNS} {_EXERCISE_FROM} WHERE e.id = ? AND {_EXERCISE_VISIBLE}",
            (self._locale, self._locale, exercise_id, user_id),
        ) as cursor:
            row = await cursor.fetchone()
        return self._exercise(row) if row else None

    async def save_exercise(self, user_id: str, exercise: Exercise) -> None:
        await self._conn.execute(
            """
            INSERT INTO exercises (
                id, user_id, category_id, name, description, body_region, equipment,
                location
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                category_id = excluded.category_id,
                name = excluded.name,
                description = excluded.description,
                body_region = excluded.body_region,
                equipment = excluded.equipment,
                location = excluded.location
            WHERE exercises.user_id = excluded.user_id
            """,
            (
                exercise.id,
                user_id,
                exercise.category_id,
                exercise.name,
                exercise.description,
                exercise.body_region,
                exercise.equipment,
                exercise.location,
            ),
        )

    async def archive_exercise(self, user_id: str, exercise_id: str) -> None:
        await self._conn.execute(
            "UPDATE exercises SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
            " WHERE id = ? AND user_id = ?",
            (exercise_id, user_id),
        )

    async def exercise_categories(self) -> tuple[tuple[str, str], ...]:
        async with self._conn.execute(
            """
            SELECT c.id, COALESCE(t.text, c.name_key) AS name
            FROM exercise_categories c
            LEFT JOIN translations t ON t.key = c.name_key AND t.locale = ?
            ORDER BY c.sort_order, c.id
            """,
            (self._locale,),
        ) as cursor:
            rows = await cursor.fetchall()
        return tuple((row["id"], row["name"]) for row in rows)

    async def list_templates(
        self, user_id: str, location: str | None
    ) -> tuple[WorkoutTemplate, ...]:
        clause = ""
        params: list[object] = [user_id]
        if location:
            clause = " AND (location = ? OR location = 'both')"
            params.append(location)

        async with self._conn.execute(
            "SELECT id, category_id, name, location, duration_min FROM workout_templates"
            f" WHERE user_id = ? AND archived_at IS NULL{clause} ORDER BY name",
            params,
        ) as cursor:
            rows = await cursor.fetchall()

        templates = []
        for row in rows:
            templates.append(
                WorkoutTemplate(
                    id=row["id"],
                    category_id=row["category_id"],
                    name=row["name"],
                    location=row["location"],
                    duration_min=row["duration_min"],
                    items=await self._items(row["id"]),
                )
            )
        return tuple(templates)

    async def load_template(self, user_id: str, template_id: str) -> WorkoutTemplate | None:
        async with self._conn.execute(
            "SELECT id, category_id, name, location, duration_min FROM workout_templates"
            " WHERE id = ? AND user_id = ? AND archived_at IS NULL",
            (template_id, user_id),
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            return None
        return WorkoutTemplate(
            id=row["id"],
            category_id=row["category_id"],
            name=row["name"],
            location=row["location"],
            duration_min=row["duration_min"],
            items=await self._items(row["id"]),
        )

    async def save_template(self, user_id: str, template: WorkoutTemplate) -> None:
        await self._conn.execute(
            """
            INSERT INTO workout_templates (id, user_id, category_id, name, location, duration_min)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                category_id = excluded.category_id,
                name = excluded.name,
                location = excluded.location,
                duration_min = excluded.duration_min,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE workout_templates.user_id = excluded.user_id
            """,
            (
                template.id,
                user_id,
                template.category_id,
                template.name,
                template.location,
                template.duration_min,
            ),
        )

    async def archive_template(self, user_id: str, template_id: str) -> None:
        await self._conn.execute(
            "UPDATE workout_templates SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
            " WHERE id = ? AND user_id = ?",
            (template_id, user_id),
        )

    async def replace_items(
        self, user_id: str, template_id: str, items: tuple[TemplateItem, ...]
    ) -> None:
        async with self._conn.execute(
            "SELECT 1 FROM workout_templates WHERE id = ? AND user_id = ?",
            (template_id, user_id),
        ) as cursor:
            if await cursor.fetchone() is None:
                return

        await self._conn.execute(
            "DELETE FROM workout_template_items WHERE template_id = ?", (template_id,)
        )
        await self._conn.executemany(
            "INSERT INTO workout_template_items"
            " (id, template_id, exercise_id, sort_order, sets, reps, duration_sec,"
            " weight_kg, rest_sec, note)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    item.id or new_id(),
                    template_id,
                    item.exercise_id,
                    index,
                    item.sets,
                    item.reps,
                    item.duration_sec,
                    item.weight_kg,
                    item.rest_sec,
                    item.note,
                )
                for index, item in enumerate(items)
            ],
        )

    async def load_schedule(self, user_id: str) -> tuple[ScheduleEntry, ...]:
        async with self._conn.execute(
            "SELECT weekday, template_id FROM workout_schedule"
            " WHERE user_id = ? ORDER BY weekday",
            (user_id,),
        ) as cursor:
            rows = await cursor.fetchall()
        return tuple(
            ScheduleEntry(weekday=row["weekday"], template_id=row["template_id"])
            for row in rows
        )

    async def replace_schedule(self, user_id: str, entries: tuple[ScheduleEntry, ...]) -> None:
        await self._conn.execute("DELETE FROM workout_schedule WHERE user_id = ?", (user_id,))
        await self._conn.executemany(
            "INSERT INTO workout_schedule (user_id, weekday, template_id)"
            " VALUES (?, ?, ?)",
            [(user_id, e.weekday, e.template_id) for e in entries],
        )

    @staticmethod
    def _exercise(row: aiosqlite.Row) -> Exercise:
        return Exercise(
            id=row["id"],
            category_id=row["category_id"],
            name=row["name"],
            description=row["description"],
            body_region=row["body_region"],
            equipment=row["equipment"],
            location=row["location"],
            met=row["met"],
            is_builtin=bool(row["is_builtin"]),
        )

    async def _items(self, template_id: str) -> tuple[TemplateItem, ...]:
        async with self._conn.execute(
            f"""
            SELECT i.id, i.exercise_id, i.sort_order, i.sets, i.reps, i.duration_sec,
                   i.weight_kg,
                   i.rest_sec, i.note, {_EXERCISE_NAME} AS exercise_name
            FROM workout_template_items i
            JOIN exercises e ON e.id = i.exercise_id
            LEFT JOIN translations t ON t.key = e.name_key AND t.locale = ?
            WHERE i.template_id = ?
            ORDER BY i.sort_order
            """,
            (self._locale, template_id),
        ) as cursor:
            rows = await cursor.fetchall()
        return tuple(
            TemplateItem(
                id=row["id"],
                exercise_id=row["exercise_id"],
                exercise_name=row["exercise_name"],
                sort_order=row["sort_order"],
                sets=row["sets"],
                reps=row["reps"],
                duration_sec=row["duration_sec"],
                weight_kg=row["weight_kg"],
                rest_sec=row["rest_sec"],
                note=row["note"],
            )
            for row in rows
        )
