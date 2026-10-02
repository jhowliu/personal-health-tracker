"""Seed the global, read-only workout templates: beginner full-body and push/pull/legs."""

import asyncio
import sys
from dataclasses import dataclass

from app.db import get_conn


@dataclass(frozen=True, slots=True)
class SeedItem:
    id: str
    exercise_id: str
    sets: int
    reps: str
    rest_sec: int


@dataclass(frozen=True, slots=True)
class SeedTemplate:
    id: str
    name: str
    items: tuple[SeedItem, ...]


TEMPLATES = (
    SeedTemplate(
        "beginner-full-body-a",
        "初階全身 A",
        (
            SeedItem("beginner-full-body-a-1", "barbell-back-squat", 3, "8", 120),
            SeedItem("beginner-full-body-a-2", "barbell-bench-press", 3, "8", 120),
            SeedItem("beginner-full-body-a-3", "lat-pulldown-machine", 3, "10", 90),
            SeedItem("beginner-full-body-a-4", "barbell-romanian-deadlift", 3, "10", 120),
            SeedItem("beginner-full-body-a-5", "dumbbell-lateral-raise", 3, "12", 60),
            SeedItem("beginner-full-body-a-6", "standing-calf-raise-machine", 3, "12", 60),
        ),
    ),
    SeedTemplate(
        "beginner-full-body-b",
        "初階全身 B",
        (
            SeedItem("beginner-full-body-b-1", "barbell-romanian-deadlift", 3, "8", 120),
            SeedItem("beginner-full-body-b-2", "barbell-overhead-press", 3, "8", 120),
            SeedItem("beginner-full-body-b-3", "seated-cable-row", 3, "10", 90),
            SeedItem("beginner-full-body-b-4", "leg-press-machine", 3, "10", 120),
            SeedItem("beginner-full-body-b-5", "dumbbell-incline-press", 3, "10", 90),
            SeedItem("beginner-full-body-b-6", "seated-leg-curl-machine", 3, "12", 60),
        ),
    ),
    SeedTemplate(
        "beginner-full-body-c",
        "初階全身 C",
        (
            SeedItem("beginner-full-body-c-1", "barbell-hip-thrust", 3, "8", 120),
            SeedItem("beginner-full-body-c-2", "barbell-bent-over-row", 3, "8", 120),
            SeedItem("beginner-full-body-c-3", "chest-press-machine", 3, "10", 90),
            SeedItem("beginner-full-body-c-4", "dumbbell-reverse-lunge", 3, "10", 90),
            SeedItem("beginner-full-body-c-5", "lat-pulldown-machine", 3, "10", 90),
            SeedItem("beginner-full-body-c-6", "dumbbell-shoulder-press", 3, "10", 90),
        ),
    ),
    # Push / pull / legs. The heavy hinge leads its day rather than following the arm work.
    SeedTemplate(
        "push-day",
        "推日",
        (
            SeedItem("push-day-1", "dumbbell-bench-press", 3, "8", 120),
            SeedItem("push-day-2", "dumbbell-incline-press", 3, "10", 90),
            SeedItem("push-day-3", "dumbbell-shoulder-press", 3, "10", 90),
            SeedItem("push-day-4", "dumbbell-lateral-raise", 3, "12", 60),
            SeedItem("push-day-5", "cable-triceps-pushdown", 3, "12", 60),
        ),
    ),
    SeedTemplate(
        "pull-day",
        "拉日",
        (
            SeedItem("pull-day-1", "barbell-deadlift", 3, "5", 180),
            SeedItem("pull-day-2", "wide-grip-seated-cable-row", 3, "10", 90),
            SeedItem("pull-day-3", "close-grip-seated-cable-row", 3, "10", 90),
            SeedItem("pull-day-4", "lat-pulldown-machine", 3, "10", 90),
            SeedItem("pull-day-5", "dumbbell-biceps-curl", 3, "12", 60),
            SeedItem("pull-day-6", "dumbbell-hammer-curl", 3, "12", 60),
        ),
    ),
    SeedTemplate(
        "leg-day",
        "腿日",
        (
            SeedItem("leg-day-1", "barbell-romanian-deadlift", 3, "8", 120),
            SeedItem("leg-day-2", "barbell-back-squat", 3, "8", 120),
            SeedItem("leg-day-3", "hip-adduction-machine", 3, "12", 60),
            SeedItem("leg-day-4", "leg-extension-machine", 3, "12", 60),
            SeedItem("leg-day-5", "seated-leg-curl-machine", 3, "12", 60),
        ),
    ),
    # The same days without a barbell: kettlebells and machines stand in for the barbell lifts.
    SeedTemplate(
        "pull-day-no-barbell",
        "拉日（無槓鈴）",
        (
            SeedItem("pull-day-no-barbell-1", "kettlebell-deadlift", 3, "10", 90),
            SeedItem("pull-day-no-barbell-2", "wide-grip-seated-cable-row", 3, "10", 90),
            SeedItem("pull-day-no-barbell-3", "close-grip-seated-cable-row", 3, "10", 90),
            SeedItem("pull-day-no-barbell-4", "lat-pulldown-machine", 3, "10", 90),
            SeedItem("pull-day-no-barbell-5", "dumbbell-biceps-curl", 3, "12", 60),
            SeedItem("pull-day-no-barbell-6", "dumbbell-hammer-curl", 3, "12", 60),
        ),
    ),
    SeedTemplate(
        "leg-day-no-barbell",
        "腿日（無槓鈴）",
        (
            SeedItem("leg-day-no-barbell-1", "kettlebell-romanian-deadlift", 3, "10", 90),
            SeedItem("leg-day-no-barbell-2", "leg-press-machine", 3, "10", 120),
            SeedItem("leg-day-no-barbell-3", "hip-adduction-machine", 3, "12", 60),
            SeedItem("leg-day-no-barbell-4", "leg-extension-machine", 3, "12", 60),
            SeedItem("leg-day-no-barbell-5", "seated-leg-curl-machine", 3, "12", 60),
        ),
    ),
)


async def seed() -> int:
    async with get_conn() as conn:
        await conn.executemany(
            """
            INSERT INTO workout_templates (
                id, user_id, category_id, name, location, duration_min, archived_at
            ) VALUES (?, NULL, 'strength', ?, 'gym', 60, NULL)
            ON CONFLICT (id) DO UPDATE SET
                category_id = excluded.category_id,
                name = excluded.name,
                location = excluded.location,
                duration_min = excluded.duration_min,
                archived_at = NULL,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE workout_templates.user_id IS NULL
            """,
            [(template.id, template.name) for template in TEMPLATES],
        )
        template_ids = tuple(template.id for template in TEMPLATES)
        placeholders = ", ".join("?" for _ in template_ids)
        await conn.execute(
            "DELETE FROM workout_template_items WHERE template_id IN "
            f"(SELECT id FROM workout_templates WHERE user_id IS NULL AND id IN ({placeholders}))",
            template_ids,
        )
        await conn.executemany(
            """
            INSERT INTO workout_template_items (
                id, template_id, exercise_id, sort_order, sets, reps, duration_sec,
                weight_kg, rest_sec, note
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL)
            """,
            [
                (
                    item.id,
                    template.id,
                    item.exercise_id,
                    sort_order,
                    item.sets,
                    item.reps,
                    item.rest_sec,
                )
                for template in TEMPLATES
                for sort_order, item in enumerate(template.items)
            ],
        )
    return len(TEMPLATES)


if __name__ == "__main__":
    count = asyncio.run(seed())
    print(f"seeded {count} workout templates", file=sys.stderr)
