from datetime import date, datetime, timedelta

import aiosqlite

from app.adapters.sqlite.foods import SqliteFoodStore
from app.adapters.sqlite.rows import from_day, from_iso, to_day, to_iso
from app.domain.ids import new_id
from app.domain.models import (
    DayFacts,
    MealItem,
    MealSlot,
    MealTime,
    PlannedMeal,
    Profile,
    WorkoutTime,
)

PLANNED_MEALS = ("breakfast", "lunch", "dinner")
STREAK_SCAN_DAYS = 400


class SqliteDayStore:
    def __init__(self, conn: aiosqlite.Connection, locale: str = "zh-TW") -> None:
        self._conn = conn
        self._foods = SqliteFoodStore(conn, locale)

    async def load_facts(self, user_id: str, day: date, profile: Profile) -> DayFacts:
        await self._ensure_day(user_id, day, profile)

        async with self._conn.execute(
            "SELECT workout_time, template_id, workout_done_at FROM days"
            " WHERE user_id = ? AND date = ?",
            (user_id, to_day(day)),
        ) as cursor:
            day_row = await cursor.fetchone()

        async with self._conn.execute(
            """
            SELECT dm.meal_time, dm.meal_id, dm.eaten_at,
                   COALESCE(SUM(COALESCE(i.kcal, f.kcal_per_100g * i.grams / 100.0)), 0) AS kcal
            FROM day_meals dm
            LEFT JOIN day_meal_items i
                   ON i.user_id = dm.user_id AND i.date = dm.date AND i.meal_time = dm.meal_time
            LEFT JOIN foods f ON f.id = i.food_id
            WHERE dm.user_id = ? AND dm.date = ?
            GROUP BY dm.meal_time, dm.meal_id, dm.eaten_at
            """,
            (user_id, to_day(day)),
        ) as cursor:
            slot_rows = await cursor.fetchall()

        async with self._conn.execute(
            "SELECT 1 FROM body_logs WHERE user_id = ? AND date = ?", (user_id, to_day(day))
        ) as cursor:
            body_logged = await cursor.fetchone() is not None

        return DayFacts(
            date=day,
            body_logged=body_logged,
            slots=tuple(
                MealSlot(
                    meal_time=MealTime(row["meal_time"]),
                    meal_id=row["meal_id"],
                    eaten_at=from_iso(row["eaten_at"]),
                    kcal=row["kcal"],
                )
                for row in slot_rows
            ),
            workout_time=WorkoutTime(day_row["workout_time"]),
            workout_done_at=from_iso(day_row["workout_done_at"]),
            has_workout_planned=day_row["template_id"] is not None,
        )

    async def update_day(
        self,
        user_id: str,
        day: date,
        *,
        workout_time: str | None = None,
        location: str | None = None,
        steps: int | None = None,
        workout_done_at: datetime | None = None,
    ) -> None:
        changes = {
            "workout_time": workout_time,
            "location": location,
            "steps": steps,
            "workout_done_at": to_iso(workout_done_at) if workout_done_at else None,
        }
        applied = {k: v for k, v in changes.items() if v is not None}
        if not applied:
            return

        assignments = ", ".join(f"{column} = ?" for column in applied)
        await self._conn.execute(
            f"UPDATE days SET {assignments} WHERE user_id = ? AND date = ?",
            (*applied.values(), user_id, to_day(day)),
        )

    async def mark_eaten(
        self, user_id: str, day: date, meal_time: MealTime, eaten_at: datetime
    ) -> None:
        await self._conn.execute(
            "UPDATE day_meals SET eaten_at = ?"
            " WHERE user_id = ? AND date = ? AND meal_time = ?",
            (to_iso(eaten_at), user_id, to_day(day), meal_time.value),
        )

    async def log_set(
        self,
        user_id: str,
        day: date,
        template_item_id: str,
        exercise_id: str,
        set_index: int,
        reps_done: int | None,
        weight_kg: float | None,
        done_at: datetime,
    ) -> None:
        await self._conn.execute(
            """
            INSERT INTO set_logs
                (id, user_id, date, template_item_id, exercise_id, set_index,
                 reps_done, weight_kg, done_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id, date, template_item_id, set_index) DO UPDATE SET
                reps_done = excluded.reps_done,
                weight_kg = excluded.weight_kg,
                done_at = excluded.done_at
            """,
            (
                new_id(),
                user_id,
                to_day(day),
                template_item_id,
                exercise_id,
                set_index,
                reps_done,
                weight_kg,
                to_iso(done_at),
            ),
        )

    async def streak_until(self, user_id: str, day: date) -> int:
        """Streak: count back from `day`. A day counts only when the body was logged
        and all three meals were marked eaten.
        """
        async with self._conn.execute(
            f"""
            SELECT d.date FROM days d
            WHERE d.user_id = ? AND d.date <= ?
              AND EXISTS (SELECT 1 FROM body_logs b
                          WHERE b.user_id = d.user_id AND b.date = d.date)
              AND (SELECT COUNT(*) FROM day_meals m
                   WHERE m.user_id = d.user_id AND m.date = d.date
                     AND m.meal_time IN {PLANNED_MEALS} AND m.eaten_at IS NOT NULL) = 3
            ORDER BY d.date DESC
            LIMIT {STREAK_SCAN_DAYS}
            """,
            (user_id, to_day(day)),
        ) as cursor:
            completed = [from_day(row["date"]) for row in await cursor.fetchall()]

        streak = 0
        expected = day
        for completed_day in completed:
            if completed_day != expected:
                break
            streak += 1
            expected -= timedelta(days=1)
        return streak

    async def load_plan(self, user_id: str, day: date) -> tuple[PlannedMeal, ...]:
        async with self._conn.execute(
            f"""
            SELECT dm.meal_time, dm.meal_id, dm.eaten_at,
                   COALESCE(m.name, '') AS meal_name
            FROM day_meals dm
            LEFT JOIN meals m ON m.id = dm.meal_id
            WHERE dm.user_id = ? AND dm.date = ? AND dm.meal_time IN {PLANNED_MEALS}
            ORDER BY dm.meal_time
            """,
            (user_id, to_day(day)),
        ) as cursor:
            slot_rows = await cursor.fetchall()

        planned = []
        for row in slot_rows:
            items = await self._plan_items(user_id, day, row["meal_time"])
            if not items and row["meal_id"] is None:
                continue
            planned.append(
                PlannedMeal(
                    meal_time=MealTime(row["meal_time"]),
                    meal_id=row["meal_id"],
                    name=row["meal_name"],
                    eaten_at=from_iso(row["eaten_at"]),
                    items=items,
                )
            )
        return tuple(planned)

    async def save_plan(
        self,
        user_id: str,
        day: date,
        meals: dict[MealTime, tuple[str, str, tuple[MealItem, ...]]],
        profile: Profile,
    ) -> None:
        # day_meals references days(user_id, date); planning may be the first thing
        # that touches this date.
        await self._ensure_day(user_id, day, profile)

        for meal_time, (meal_id, _name, items) in meals.items():
            async with self._conn.execute(
                "SELECT eaten_at FROM day_meals"
                " WHERE user_id = ? AND date = ? AND meal_time = ?",
                (user_id, to_day(day), meal_time.value),
            ) as cursor:
                existing = await cursor.fetchone()

            # What someone already ate is a fact; a reshuffle does not get to rewrite it.
            if existing and existing["eaten_at"] is not None:
                continue

            await self._conn.execute(
                "INSERT INTO day_meals (user_id, date, meal_time, meal_id)"
                " VALUES (?, ?, ?, ?)"
                " ON CONFLICT (user_id, date, meal_time) DO UPDATE SET meal_id = excluded.meal_id",
                (user_id, to_day(day), meal_time.value, meal_id),
            )
            await self._conn.execute(
                "DELETE FROM day_meal_items"
                " WHERE user_id = ? AND date = ? AND meal_time = ?",
                (user_id, to_day(day), meal_time.value),
            )
            await self._conn.executemany(
                "INSERT INTO day_meal_items"
                " (id, user_id, date, meal_time, food_id, grams, sort_order)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                [
                    (item.id, user_id, to_day(day), meal_time.value, item.food.id,
                     item.grams, index)
                    for index, item in enumerate(items)
                ],
            )

    async def replace_plan_item(
        self,
        user_id: str,
        day: date,
        meal_time: MealTime,
        item_id: str,
        food_id: str,
        grams: float,
    ) -> None:
        await self._conn.execute(
            "UPDATE day_meal_items SET food_id = ?, grams = ?"
            " WHERE id = ? AND user_id = ? AND date = ? AND meal_time = ?",
            (food_id, grams, item_id, user_id, to_day(day), meal_time.value),
        )

    async def _plan_items(
        self, user_id: str, day: date, meal_time: str
    ) -> tuple[MealItem, ...]:
        async with self._conn.execute(
            "SELECT id, food_id, grams, sort_order FROM day_meal_items"
            " WHERE user_id = ? AND date = ? AND meal_time = ? AND food_id IS NOT NULL"
            " ORDER BY sort_order",
            (user_id, to_day(day), meal_time),
        ) as cursor:
            rows = await cursor.fetchall()

        items = []
        for row in rows:
            food = await self._foods.load(user_id, row["food_id"])
            if food is None:
                continue
            items.append(
                MealItem(
                    id=row["id"],
                    food=food,
                    grams=row["grams"],
                    sort_order=row["sort_order"],
                )
            )
        return tuple(items)

    async def _ensure_day(self, user_id: str, day: date, profile: Profile) -> None:
        await self._conn.execute(
            "INSERT INTO days (user_id, date, workout_time, location)"
            " VALUES (?, ?, ?, ?) ON CONFLICT (user_id, date) DO NOTHING",
            (user_id, to_day(day), profile.workout_time.value, profile.default_location.value),
        )
        # The schedule may have been set after the day was opened, or the user may have
        # changed location, so backfill the template on every read.
        await self._conn.execute(
            """
            UPDATE days SET template_id = (
                SELECT ws.template_id FROM workout_schedule ws
                WHERE ws.user_id = days.user_id
                  AND ws.weekday = ?
                  AND ws.location = days.location
            )
            WHERE user_id = ? AND date = ? AND template_id IS NULL
            """,
            (day.weekday(), user_id, to_day(day)),
        )
        await self._conn.executemany(
            "INSERT INTO day_meals (user_id, date, meal_time) VALUES (?, ?, ?)"
            " ON CONFLICT (user_id, date, meal_time) DO NOTHING",
            [(user_id, to_day(day), meal_time) for meal_time in PLANNED_MEALS],
        )
