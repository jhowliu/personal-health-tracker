"""Seed the global, read-only workout templates: beginner full-body, push/pull/legs, a glute
day and a posture day."""

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
    duration_min: int = 60
    location: str = "gym"


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
    # Glutes: swings wake the hips up while fresh, then the heavy thrust and hinge, then
    # single-leg work and the abductors.
    SeedTemplate(
        "glute-day",
        "練臀日（健身房）",
        (
            SeedItem("glute-day-1", "kettlebell-swing", 3, "15", 60),
            SeedItem("glute-day-2", "barbell-hip-thrust", 4, "8", 120),
            SeedItem("glute-day-3", "barbell-romanian-deadlift", 3, "8", 120),
            SeedItem("glute-day-4", "dumbbell-bulgarian-split-squat", 3, "10", 90),
            SeedItem("glute-day-5", "hip-abduction-machine", 3, "15", 60),
        ),
    ),
    # Rounded shoulders and upper back: loosen the thoracic spine, then strengthen the rear
    # delts and the muscles that pull the shoulder blades back.
    SeedTemplate(
        "posture-day",
        "圓肩駝背改善（健身房）",
        (
            SeedItem("posture-day-1", "cat-cow", 2, "10", 30),
            SeedItem("posture-day-2", "thoracic-rotation", 2, "10", 30),
            SeedItem("posture-day-3", "band-pull-apart", 3, "15", 45),
            SeedItem("posture-day-4", "cable-face-pull", 3, "15", 60),
            SeedItem("posture-day-5", "reverse-pec-deck-machine", 3, "12", 60),
            SeedItem("posture-day-6", "wide-grip-seated-cable-row", 3, "12", 90),
        ),
        duration_min=45,
    ),
    # The same two days with nothing but the body: no barbell, machine, cable or band.
    SeedTemplate(
        "glute-day-bodyweight",
        "練臀日（徒手）",
        (
            SeedItem("glute-day-bodyweight-1", "hip-flexor-stretch", 2, "10", 30),
            SeedItem("glute-day-bodyweight-2", "glute-bridge", 4, "20", 45),
            SeedItem("glute-day-bodyweight-3", "bodyweight-walking-lunge", 3, "12", 60),
            SeedItem("glute-day-bodyweight-4", "bodyweight-squat", 3, "20", 60),
        ),
        duration_min=30,
        location="home",
    ),
    SeedTemplate(
        "posture-day-bodyweight",
        "圓肩駝背改善（徒手）",
        (
            SeedItem("posture-day-bodyweight-1", "cat-cow", 2, "10", 30),
            SeedItem("posture-day-bodyweight-2", "thoracic-rotation", 2, "10", 30),
            SeedItem("posture-day-bodyweight-3", "worlds-greatest-stretch", 2, "6", 30),
            SeedItem("posture-day-bodyweight-4", "shoulder-circles", 2, "10", 30),
            SeedItem("posture-day-bodyweight-5", "inverted-row", 3, "10", 90),
        ),
        duration_min=30,
        location="home",
    ),
)


async def seed() -> int:
    async with get_conn() as conn:
        await conn.executemany(
            """
            INSERT INTO workout_templates (
                id, user_id, category_id, name, location, duration_min, archived_at
            ) VALUES (?, NULL, 'strength', ?, ?, ?, NULL)
            ON CONFLICT (id) DO UPDATE SET
                category_id = excluded.category_id,
                name = excluded.name,
                location = excluded.location,
                duration_min = excluded.duration_min,
                archived_at = NULL,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE workout_templates.user_id IS NULL
            """,
            [
                (template.id, template.name, template.location, template.duration_min)
                for template in TEMPLATES
            ],
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
