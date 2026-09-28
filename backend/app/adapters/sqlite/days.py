from datetime import date, datetime, timedelta

import aiosqlite

from app.adapters.sqlite.foods import SqliteFoodStore
from app.adapters.sqlite.rows import from_day, from_iso, to_day, to_iso
from app.domain.ids import new_id
from app.domain.models import (
    ZERO_NUTRIENTS,
    DayFacts,
    Food,
    FrozenNutrition,
    MealItem,
    MealSlot,
    MealTime,
    Nutrients,
    PlannedMeal,
    PlateItem,
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
            "SELECT workout_time, template_id, workout_done_at, workout_skipped_at FROM days"
            " WHERE user_id = ? AND date = ?",
            (user_id, to_day(day)),
        ) as cursor:
            day_row = await cursor.fetchone()

        async with self._conn.execute(
            "SELECT meal_time, meal_id, eaten_at, skipped_at FROM day_meals"
            " WHERE user_id = ? AND date = ?",
            (user_id, to_day(day)),
        ) as cursor:
            slot_rows = await cursor.fetchall()
        items = await self._load_items(user_id, day)

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
                    skipped_at=from_iso(row["skipped_at"]),
                    nutrients=sum(
                        (i.nutrients for i in items.get(row["meal_time"], ())), ZERO_NUTRIENTS
                    ),
                )
                for row in slot_rows
            ),
            workout_time=WorkoutTime(day_row["workout_time"]),
            workout_done_at=from_iso(day_row["workout_done_at"]),
            workout_skipped_at=from_iso(day_row["workout_skipped_at"]),
            has_workout_planned=day_row["template_id"] is not None,
        )

    async def update_day(
        self,
        user_id: str,
        day: date,
        profile: Profile,
        *,
        workout_time: str | None = None,
        location: str | None = None,
        steps: int | None = None,
        workout_state: str | None = None,
        workout_state_at: datetime | None = None,
    ) -> None:
        await self._ensure_day(user_id, day, profile)
        changes = {
            "workout_time": workout_time,
            "location": location,
            "steps": steps,
        }
        applied = {k: v for k, v in changes.items() if v is not None}
        if workout_state == "done":
            applied["workout_done_at"] = to_iso(workout_state_at)
            applied["workout_skipped_at"] = None
        elif workout_state == "skipped":
            applied["workout_done_at"] = None
            applied["workout_skipped_at"] = to_iso(workout_state_at)
        if not applied:
            return

        assignments = ", ".join(f"{column} = ?" for column in applied)
        await self._conn.execute(
            f"UPDATE days SET {assignments} WHERE user_id = ? AND date = ?",
            (*applied.values(), user_id, to_day(day)),
        )

    async def set_meal_state(
        self,
        user_id: str,
        day: date,
        meal_time: MealTime,
        state: str,
        at: datetime,
        profile: Profile,
    ) -> None:
        await self._ensure_day(user_id, day, profile)
        assignments = {
            "eaten": ("eaten_at = ?, skipped_at = NULL", (to_iso(at),)),
            "skipped": ("eaten_at = NULL, skipped_at = ?", (to_iso(at),)),
            "planned": ("eaten_at = NULL, skipped_at = NULL", ()),
        }
        assignment, values = assignments[state]
        await self._conn.execute(
            f"UPDATE day_meals SET {assignment} WHERE user_id = ? AND date = ? AND meal_time = ?",
            (*values, user_id, to_day(day), meal_time.value),
        )
        # Eating a meal records what it was; anything else goes back to following the Food.
        await self._freeze_slot(
            user_id, day, meal_time.value, refresh=True, freeze=state == "eaten"
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
        and all three meals were marked eaten or skipped.
        """
        async with self._conn.execute(
            f"""
            SELECT d.date FROM days d
            WHERE d.user_id = ? AND d.date <= ?
              AND EXISTS (SELECT 1 FROM body_logs b
                          WHERE b.user_id = d.user_id AND b.date = d.date)
              AND (SELECT COUNT(*) FROM day_meals m
                   WHERE m.user_id = d.user_id AND m.date = d.date
                      AND m.meal_time IN {PLANNED_MEALS}
                      AND (m.eaten_at IS NOT NULL OR m.skipped_at IS NOT NULL)) = 3
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
            SELECT dm.meal_time, dm.meal_id, dm.eaten_at, dm.skipped_at,
                   COALESCE(m.name, '') AS meal_name
            FROM day_meals dm
            LEFT JOIN meals m ON m.id = dm.meal_id
            WHERE dm.user_id = ? AND dm.date = ? AND dm.meal_time IN {PLANNED_MEALS}
            ORDER BY dm.meal_time
            """,
            (user_id, to_day(day)),
        ) as cursor:
            slot_rows = await cursor.fetchall()

        items = await self._load_items(user_id, day)
        planned = []
        for row in slot_rows:
            slot_items = items.get(row["meal_time"], ())
            if not slot_items and row["meal_id"] is None:
                continue
            planned.append(
                PlannedMeal(
                    meal_time=MealTime(row["meal_time"]),
                    meal_id=row["meal_id"],
                    name=row["meal_name"],
                    eaten_at=from_iso(row["eaten_at"]),
                    skipped_at=from_iso(row["skipped_at"]),
                    items=slot_items,
                )
            )
        return tuple(planned)

    async def load_extras(self, user_id: str, day: date) -> tuple[PlateItem, ...]:
        return (await self._load_items(user_id, day)).get(MealTime.EXTRAS.value, ())

    async def add_extra(self, user_id: str, day: date, item: PlateItem, profile: Profile) -> None:
        await self._ensure_day(user_id, day, profile)
        await self._insert_item(user_id, day, MealTime.EXTRAS, item)

    async def delete_extra(self, user_id: str, day: date, item_id: str) -> bool:
        cursor = await self._conn.execute(
            "DELETE FROM day_meal_items WHERE id = ? AND user_id = ? AND date = ? "
            "AND meal_time = 'extras'",
            (item_id, user_id, to_day(day)),
        )
        return cursor.rowcount == 1

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
                "SELECT eaten_at, skipped_at FROM day_meals "
                "WHERE user_id = ? AND date = ? AND meal_time = ?",
                (user_id, to_day(day), meal_time.value),
            ) as cursor:
                existing = await cursor.fetchone()

            # Completed slots are facts; a reshuffle does not get to rewrite them.
            if existing and (
                existing["eaten_at"] is not None or existing["skipped_at"] is not None
            ):
                continue

            await self._conn.execute(
                "INSERT INTO day_meals (user_id, date, meal_time, meal_id)"
                " VALUES (?, ?, ?, ?)"
                " ON CONFLICT (user_id, date, meal_time) DO UPDATE SET meal_id = excluded.meal_id",
                (user_id, to_day(day), meal_time.value, meal_id),
            )
            await self._conn.execute(
                "DELETE FROM day_meal_items WHERE user_id = ? AND date = ? AND meal_time = ?",
                (user_id, to_day(day), meal_time.value),
            )
            await self._conn.executemany(
                "INSERT INTO day_meal_items"
                " (id, user_id, date, meal_time, food_id, grams, sort_order)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                [
                    (
                        item.id,
                        user_id,
                        to_day(day),
                        meal_time.value,
                        item.food.id,
                        item.grams,
                        index,
                    )
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
            "UPDATE day_meal_items SET food_id = ?, grams = ?,"
            " kcal = NULL, protein_g = NULL, fat_g = NULL, carb_g = NULL,"
            " nutrition_snapshot_grams = NULL"
            " WHERE id = ? AND user_id = ? AND date = ? AND meal_time = ?",
            (food_id, grams, item_id, user_id, to_day(day), meal_time.value),
        )
        await self._freeze_slot(user_id, day, meal_time.value)

    async def add_plan_item(
        self, user_id: str, day: date, meal_time: MealTime, item: PlateItem, profile: Profile
    ) -> None:
        await self._ensure_day(user_id, day, profile)
        await self._insert_item(user_id, day, meal_time, item)
        await self._freeze_slot(user_id, day, meal_time.value)

    async def update_plan_item(
        self, user_id: str, day: date, meal_time: MealTime, item_id: str, grams: float
    ) -> bool:
        cursor = await self._conn.execute(
            "UPDATE day_meal_items SET grams = ? WHERE id = ? AND user_id = ? AND date = ? "
            "AND meal_time = ? AND food_id IS NOT NULL",
            (grams, item_id, user_id, to_day(day), meal_time.value),
        )
        return cursor.rowcount == 1

    async def delete_plan_item(
        self, user_id: str, day: date, meal_time: MealTime, item_id: str
    ) -> bool:
        cursor = await self._conn.execute(
            "DELETE FROM day_meal_items WHERE id = ? AND user_id = ? AND date = ? "
            "AND meal_time = ?",
            (item_id, user_id, to_day(day), meal_time.value),
        )
        return cursor.rowcount == 1

    async def _insert_item(
        self, user_id: str, day: date, meal_time: MealTime, item: PlateItem
    ) -> None:
        await self._conn.execute(
            "INSERT INTO day_meals (user_id, date, meal_time) VALUES (?, ?, ?) "
            "ON CONFLICT (user_id, date, meal_time) DO NOTHING",
            (user_id, to_day(day), meal_time.value),
        )
        async with self._conn.execute(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM day_meal_items "
            "WHERE user_id = ? AND date = ? AND meal_time = ?",
            (user_id, to_day(day), meal_time.value),
        ) as cursor:
            next_order = (await cursor.fetchone())["next_order"]
        await self._conn.execute(
            """
            INSERT INTO day_meal_items
            (id, user_id, date, meal_time, food_id, custom_name, grams, photo_id, sort_order,
             kcal, protein_g, fat_g, carb_g, nutrition_snapshot_grams)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item.id,
                user_id,
                to_day(day),
                meal_time.value,
                item.food_id,
                item.custom_name,
                item.grams,
                item.photo_id,
                next_order,
                *_nutrition_columns(item),
            ),
        )

    async def _load_items(self, user_id: str, day: date) -> dict[str, tuple[PlateItem, ...]]:
        """Every plate item of the day, by meal slot, straight from the stored columns."""
        async with self._conn.execute(
            "SELECT id, meal_time, food_id, custom_name, grams, kcal, protein_g, fat_g, carb_g,"
            " nutrition_snapshot_grams, photo_id, sort_order"
            " FROM day_meal_items WHERE user_id = ? AND date = ?"
            " ORDER BY meal_time, sort_order, created_at",
            (user_id, to_day(day)),
        ) as cursor:
            rows = await cursor.fetchall()

        foods: dict[str, Food | None] = {}
        by_slot: dict[str, list[PlateItem]] = {}
        for row in rows:
            food_id = row["food_id"]
            if food_id and food_id not in foods:
                foods[food_id] = await self._foods.load_referenced(user_id, food_id)
            food = foods.get(food_id) if food_id else None
            if food_id and food is None:
                continue
            by_slot.setdefault(row["meal_time"], []).append(_item_from_row(row, food))
        return {slot: tuple(items) for slot, items in by_slot.items()}

    async def _freeze_slot(
        self, user_id: str, day: date, meal_time: str, *, refresh: bool = False, freeze: bool = True
    ) -> None:
        """Keep a slot's stored nutrition in step with whether it has been eaten.

        Only eaten slots freeze. Without `refresh`, items that are already frozen keep the
        nutrition they were frozen with.
        """
        async with self._conn.execute(
            "SELECT eaten_at FROM day_meals WHERE user_id = ? AND date = ? AND meal_time = ?",
            (user_id, to_day(day), meal_time),
        ) as cursor:
            slot = await cursor.fetchone()
        if freeze and (slot is None or slot["eaten_at"] is None):
            return

        items = (await self._load_items(user_id, day)).get(meal_time, ())
        await self._conn.executemany(
            "UPDATE day_meal_items SET kcal = ?, protein_g = ?, fat_g = ?, carb_g = ?,"
            " nutrition_snapshot_grams = ? WHERE id = ? AND user_id = ?",
            [
                (*_nutrition_columns(updated), updated.id, user_id)
                for item in items
                if item.food is not None
                and (updated := _refrozen(item, refresh=refresh, freeze=freeze)) is not item
            ],
        )

    async def _ensure_day(self, user_id: str, day: date, profile: Profile) -> None:
        await self._conn.execute(
            "INSERT INTO days (user_id, date, workout_time, location)"
            " VALUES (?, ?, ?, ?) ON CONFLICT (user_id, date) DO NOTHING",
            (user_id, to_day(day), profile.workout_time.value, profile.default_location.value),
        )
        # The schedule may have been set after the day was opened, so backfill on every read.
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
        await self._conn.executemany(
            "INSERT INTO day_meals (user_id, date, meal_time) VALUES (?, ?, ?)"
            " ON CONFLICT (user_id, date, meal_time) DO NOTHING",
            [(user_id, to_day(day), meal_time) for meal_time in PLANNED_MEALS],
        )


def _refrozen(item: PlateItem, *, refresh: bool, freeze: bool) -> PlateItem:
    if not freeze:
        return item.unfreeze()
    return item.freeze() if refresh or item.frozen is None else item


def _nutrition_columns(item: PlateItem) -> tuple[float | None, ...]:
    """kcal, protein, fat, carb, snapshot grams — what the row stores for this item."""
    if item.frozen is not None:
        n = item.frozen.nutrients
        return (n.kcal, n.protein_g, n.fat_g, n.carb_g, item.frozen.grams)
    if item.custom_nutrients is not None:
        n = item.custom_nutrients
        return (n.kcal, n.protein_g, n.fat_g, n.carb_g, None)
    return (None, None, None, None, None)


def _item_from_row(row: aiosqlite.Row, food: Food | None) -> PlateItem:
    return PlateItem(
        id=row["id"],
        food=food,
        custom_name=row["custom_name"],
        grams=row["grams"],
        custom_nutrients=(
            None
            if food
            else Nutrients(row["kcal"], row["protein_g"], row["fat_g"], row["carb_g"])
        ),
        photo_id=row["photo_id"],
        sort_order=row["sort_order"],
        frozen=(
            FrozenNutrition(
                row["nutrition_snapshot_grams"],
                Nutrients(row["kcal"], row["protein_g"], row["fat_g"], row["carb_g"]),
            )
            if food and row["nutrition_snapshot_grams"] is not None
            else None
        ),
    )
