import json
from datetime import date

import aiosqlite

from app.adapters.sqlite.rows import from_iso, to_day, to_iso
from app.domain.ids import new_id
from app.domain.models import Exercise, Profile, WorkoutTemplate
from app.domain.workout_execution import (
    DayWorkoutItem,
    ReplacementReason,
    SetEffort,
    SetLog,
    WorkoutExecution,
    WorkoutExecutionItem,
)

_SNAPSHOT_COLUMNS = (
    "id, user_id, date, exercise_id, sort_order, sets, reps, duration_sec, weight_kg,"
    " rest_sec, note, source_item_id"
)


class SqliteWorkoutExecutionStore:
    def __init__(self, conn: aiosqlite.Connection, locale: str = "zh-TW") -> None:
        self._conn = conn
        self._locale = locale

    async def load(self, user_id: str, day: date, profile: Profile) -> WorkoutExecution:
        await self._ensure_day(user_id, day, profile)
        await self._ensure_snapshot(user_id, day)

        async with self._conn.execute(
            """
            WITH logs AS (
                SELECT day_workout_item_id,
                       json_group_array(json_object(
                           'day_workout_item_id', day_workout_item_id,
                           'exercise_id', exercise_id,
                           'set_index', set_index,
                           'reps_done', reps_done,
                           'duration_sec', duration_sec,
                           'weight_kg', weight_kg,
                           'effort', effort,
                           'done_at', done_at
                       )) AS logs_json
                FROM (
                    SELECT day_workout_item_id, exercise_id, set_index, reps_done,
                           duration_sec, weight_kg, effort, done_at
                    FROM set_logs
                    WHERE user_id = ? AND date = ? AND day_workout_item_id IS NOT NULL
                    ORDER BY day_workout_item_id, set_index
                )
                GROUP BY day_workout_item_id
            )
            SELECT w.id AS item_id, w.exercise_id, w.sort_order, w.sets, w.reps,
                   w.duration_sec, w.weight_kg, w.rest_sec, w.note, w.source_item_id,
                   w.replacement_reason,
                   COALESCE(e.name, names.text, e.name_key) AS exercise_name,
                   e.met,
                   COALESCE(re.name, replaced_names.text, re.name_key) AS replaced_name,
                   t.id AS template_id, t.category_id AS template_category_id,
                   t.name AS template_name, t.location AS template_location, t.duration_min,
                   logs.logs_json
            FROM days d
            LEFT JOIN workout_templates t ON t.id = d.template_id AND t.user_id = d.user_id
                                         AND t.archived_at IS NULL
            LEFT JOIN day_workout_items w ON w.user_id = d.user_id AND w.date = d.date
            LEFT JOIN exercises e ON e.id = w.exercise_id
            LEFT JOIN translations names ON names.key = e.name_key AND names.locale = ?
            LEFT JOIN exercises re ON re.id = w.replaced_exercise_id
            LEFT JOIN translations replaced_names
                   ON replaced_names.key = re.name_key AND replaced_names.locale = ?
            LEFT JOIN logs ON logs.day_workout_item_id = w.id
            WHERE d.user_id = ? AND d.date = ?
            ORDER BY w.sort_order
            """,
            (user_id, to_day(day), self._locale, self._locale, user_id, to_day(day)),
        ) as cursor:
            rows = await cursor.fetchall()

        if not rows:
            return WorkoutExecution(day, None, ())

        first = rows[0]
        entries = tuple(self._entry(row) for row in rows if row["item_id"] is not None)
        template = None
        if first["template_id"] is not None:
            template = WorkoutTemplate(
                id=first["template_id"],
                category_id=first["template_category_id"],
                name=first["template_name"],
                location=first["template_location"],
                duration_min=first["duration_min"],
                items=(),
            )
        return WorkoutExecution(day, template, entries)

    async def load_visible_exercise(self, user_id: str, exercise_id: str) -> Exercise | None:
        async with self._conn.execute(
            """
            SELECT e.id, e.category_id, COALESCE(e.name, names.text, e.name_key) AS name,
                   COALESCE(e.description, descriptions.text) AS description,
                   e.body_region, e.equipment, e.location, e.met,
                   e.user_id IS NULL AS is_builtin
            FROM exercises e
            LEFT JOIN translations names ON names.key = e.name_key AND names.locale = ?
            LEFT JOIN translations descriptions
                   ON descriptions.key = e.description_key AND descriptions.locale = ?
            WHERE e.id = ? AND (e.user_id IS NULL OR e.user_id = ?) AND e.archived_at IS NULL
            """,
            (self._locale, self._locale, exercise_id, user_id),
        ) as cursor:
            row = await cursor.fetchone()
        if row is None:
            return None
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

    async def add_item(
        self, user_id: str, day: date, profile: Profile, item: DayWorkoutItem
    ) -> None:
        await self._ensure_day(user_id, day, profile)
        async with self._conn.execute(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM day_workout_items "
            "WHERE user_id = ? AND date = ?",
            (user_id, to_day(day)),
        ) as cursor:
            next_order = (await cursor.fetchone())["next_order"]
        await self._conn.execute(
            f"INSERT INTO day_workout_items ({_SNAPSHOT_COLUMNS}) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                item.id,
                user_id,
                to_day(day),
                item.exercise_id,
                next_order,
                item.sets,
                item.reps,
                item.duration_sec,
                item.weight_kg,
                item.rest_sec,
                item.note,
                None,
            ),
        )

    async def update_item(
        self, user_id: str, day: date, item: DayWorkoutItem, *, replacing: bool
    ) -> bool:
        """Update one snapshot while retaining the template's original exercise on swaps."""
        cursor = await self._conn.execute(
            """
            UPDATE day_workout_items
            SET exercise_id = ?, sets = ?, reps = ?, duration_sec = ?, weight_kg = ?,
                rest_sec = ?, note = ?,
                replaced_exercise_id = CASE WHEN ? THEN COALESCE(replaced_exercise_id, exercise_id)
                                             ELSE replaced_exercise_id END,
                replacement_reason = CASE WHEN ? THEN ? ELSE replacement_reason END
            WHERE id = ? AND user_id = ? AND date = ?
            """,
            (
                item.exercise_id,
                item.sets,
                item.reps,
                item.duration_sec,
                item.weight_kg,
                item.rest_sec,
                item.note,
                replacing,
                replacing,
                item.replacement_reason.value if item.replacement_reason else None,
                item.id,
                user_id,
                to_day(day),
            ),
        )
        return cursor.rowcount == 1

    async def delete_item(self, user_id: str, day: date, item_id: str) -> bool:
        cursor = await self._conn.execute(
            "DELETE FROM day_workout_items WHERE id = ? AND user_id = ? AND date = ?",
            (item_id, user_id, to_day(day)),
        )
        return cursor.rowcount == 1

    async def log_set(self, user_id: str, day: date, profile: Profile, log: SetLog) -> None:
        await self._ensure_day(user_id, day, profile)
        await self._conn.execute(
            """
            INSERT INTO set_logs
                (id, user_id, date, day_workout_item_id, exercise_id, set_index,
                 reps_done, duration_sec, weight_kg, effort, done_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id, date, day_workout_item_id, set_index) DO UPDATE SET
                reps_done = excluded.reps_done,
                duration_sec = excluded.duration_sec,
                weight_kg = excluded.weight_kg,
                effort = excluded.effort,
                done_at = excluded.done_at
            """,
            (
                new_id(),
                user_id,
                to_day(day),
                log.day_workout_item_id,
                log.exercise_id,
                log.set_index,
                log.reps_done,
                log.duration_sec,
                log.weight_kg,
                log.effort.value if log.effort else None,
                to_iso(log.done_at),
            ),
        )

    async def apply_template_weight(
        self, user_id: str, template_id: str, item_id: str, weight_kg: float
    ) -> bool:
        cursor = await self._conn.execute(
            """
            UPDATE workout_template_items
            SET weight_kg = ?
            WHERE id = ? AND template_id = ?
              AND EXISTS (
                  SELECT 1 FROM workout_templates
                  WHERE id = ? AND user_id = ? AND archived_at IS NULL
              )
            """,
            (weight_kg, item_id, template_id, template_id, user_id),
        )
        return cursor.rowcount == 1

    def _entry(self, row: aiosqlite.Row) -> WorkoutExecutionItem:
        item = DayWorkoutItem(
            id=row["item_id"],
            exercise_id=row["exercise_id"],
            exercise_name=row["exercise_name"],
            sort_order=row["sort_order"],
            sets=row["sets"],
            reps=row["reps"],
            duration_sec=row["duration_sec"],
            weight_kg=row["weight_kg"],
            rest_sec=row["rest_sec"],
            note=row["note"],
            met=row["met"],
            replaced_exercise_name=row["replaced_name"],
            replacement_reason=(
                ReplacementReason(row["replacement_reason"])
                if row["replacement_reason"]
                else None
            ),
            source_item_id=row["source_item_id"],
        )
        logs = tuple(
            SetLog(
                day_workout_item_id=value["day_workout_item_id"],
                exercise_id=value["exercise_id"],
                set_index=value["set_index"],
                reps_done=value["reps_done"],
                duration_sec=value["duration_sec"],
                weight_kg=value["weight_kg"],
                effort=SetEffort(value["effort"]) if value["effort"] else None,
                done_at=from_iso(value["done_at"]),
            )
            for value in json.loads(row["logs_json"] or "[]")
        )
        return WorkoutExecutionItem(item, logs)

    async def _ensure_day(self, user_id: str, day: date, profile: Profile) -> None:
        await self._conn.execute(
            "INSERT INTO days (user_id, date, workout_time, location)"
            " VALUES (?, ?, ?, ?) ON CONFLICT (user_id, date) DO NOTHING",
            (user_id, to_day(day), profile.workout_time.value, profile.default_location.value),
        )
        await self._conn.execute(
            """
            UPDATE days SET template_id = (
                SELECT ws.template_id FROM workout_schedule ws
                WHERE ws.user_id = days.user_id AND ws.weekday = ?
            )
            WHERE user_id = ? AND date = ? AND template_id IS NULL
            """,
            (day.weekday(), user_id, to_day(day)),
        )

    async def _ensure_snapshot(self, user_id: str, day: date) -> None:
        """Copy the scheduled template into the day the first time it is opened.

        Once a copy exists it is never refreshed: later edits to the template belong to
        later days, not to this one.
        """
        async with self._conn.execute(
            "SELECT 1 FROM day_workout_items WHERE user_id = ? AND date = ? LIMIT 1",
            (user_id, to_day(day)),
        ) as cursor:
            if await cursor.fetchone():
                return

        async with self._conn.execute(
            """
            SELECT i.id, i.exercise_id, i.sort_order, i.sets, i.reps, i.duration_sec,
                   i.weight_kg, i.rest_sec, i.note
            FROM days d
            JOIN workout_templates t ON t.id = d.template_id AND t.user_id = d.user_id
                                    AND t.archived_at IS NULL
            JOIN workout_template_items i ON i.template_id = t.id
            WHERE d.user_id = ? AND d.date = ?
            ORDER BY i.sort_order
            """,
            (user_id, to_day(day)),
        ) as cursor:
            rows = await cursor.fetchall()

        if not rows:
            return

        await self._conn.executemany(
            f"INSERT INTO day_workout_items ({_SNAPSHOT_COLUMNS})"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    new_id(),
                    user_id,
                    to_day(day),
                    row["exercise_id"],
                    row["sort_order"],
                    row["sets"],
                    row["reps"],
                    row["duration_sec"],
                    row["weight_kg"],
                    row["rest_sec"],
                    row["note"],
                    row["id"],
                )
                for row in rows
            ],
        )
