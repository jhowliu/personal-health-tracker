import aiosqlite
from httpx import AsyncClient

from app.config import settings
from seeds.exercises import EXERCISES, seed


async def test_exercise_seed_is_idempotent_and_catalog_migration_is_applied(api: AsyncClient):
    assert await seed() == len(EXERCISES)
    assert await seed() == len(EXERCISES)

    async with aiosqlite.connect(settings.db_path) as conn:
        columns = {
            row[1] for row in await (await conn.execute("PRAGMA table_info(exercises)")).fetchall()
        }
        indexes = {
            row[1] for row in await (await conn.execute("PRAGMA index_list(exercises)")).fetchall()
        }
        count = (await (await conn.execute("SELECT COUNT(*) FROM exercises")).fetchone())[0]
        row = await (
            await conn.execute(
                "SELECT name_key, description_key, body_region, equipment "
                "FROM exercises WHERE id = 'barbell-back-squat'"
            )
        ).fetchone()
        translations = (
            await (
                await conn.execute(
                    "SELECT COUNT(*) FROM translations "
                    "WHERE key IN ("
                    "'exercise.barbell-back-squat.name', "
                    "'exercise.barbell-back-squat.description'"
                    ") AND locale IN ('zh-TW', 'en')"
                )
            ).fetchone()
        )[0]
        await conn.execute(
            "INSERT INTO users (id, email) VALUES ('catalog-collision', 'collision@example.com')"
        )
        await conn.execute(
            """
            UPDATE exercises
            SET user_id = 'catalog-collision', name_key = NULL, name = '保留的自訂動作'
            WHERE id = 'barbell-back-squat'
            """
        )
        await conn.commit()

    assert await seed() == len(EXERCISES)

    async with aiosqlite.connect(settings.db_path) as conn:
        collision = await (
            await conn.execute(
                "SELECT user_id, name FROM exercises WHERE id = 'barbell-back-squat'"
            )
        ).fetchone()

    assert {"body_region", "equipment"} <= columns
    assert "idx_exercises_active_catalog" in indexes
    assert count == len(EXERCISES)
    assert row == (
        "exercise.barbell-back-squat.name",
        "exercise.barbell-back-squat.description",
        "lower_body",
        "barbell",
    )
    assert translations == 4
    assert collision == ("catalog-collision", "保留的自訂動作")


async def test_exercise_catalog_can_filter_and_search_translated_builtins(
    with_exercises: AsyncClient,
):
    filtered = await with_exercises.get(
        "/exercises",
        params={"category_id": "strength", "body_region": "lower_body", "equipment": "machine"},
    )
    assert filtered.status_code == 200
    assert {exercise["id"] for exercise in filtered.json()} == {
        "leg-extension-machine",
        "leg-press-machine",
        "seated-leg-curl-machine",
        "standing-calf-raise-machine",
    }
    assert all(exercise["is_builtin"] for exercise in filtered.json())

    searched = await with_exercises.get("/exercises", params={"q": "Incline Treadmill"})
    assert searched.status_code == 200
    assert [exercise["id"] for exercise in searched.json()] == ["incline-treadmill-walk"]


async def test_custom_exercise_preserves_nullable_catalog_metadata(with_exercises: AsyncClient):
    created = await with_exercises.post(
        "/exercises",
        json={
            "category_id": "strength",
            "name": "我的啞鈴划船",
            "body_region": "upper_body",
            "equipment": "dumbbell",
        },
    )
    assert created.status_code == 201
    exercise = created.json()
    assert exercise["is_builtin"] is False
    assert exercise["description"] is None
    assert exercise["body_region"] == "upper_body"
    assert exercise["equipment"] == "dumbbell"

    updated = await with_exercises.patch(
        f"/exercises/{exercise['id']}",
        json={
            "category_id": "strength",
            "name": "我的槓鈴划船",
            "description": "自訂紀錄",
            "body_region": "upper_body",
            "equipment": "barbell",
        },
    )
    assert updated.status_code == 204

    listed = await with_exercises.get(
        "/exercises", params={"q": "我的槓鈴", "equipment": "barbell"}
    )
    assert listed.status_code == 200
    assert listed.json() == [
        {
            "id": exercise["id"],
            "category_id": "strength",
            "name": "我的槓鈴划船",
            "description": "自訂紀錄",
            "body_region": "upper_body",
            "equipment": "barbell",
            "location": None,
            "met": None,
            "is_builtin": False,
        }
    ]


async def test_builtin_exercises_cannot_be_mutated_or_deleted(with_exercises: AsyncClient):
    payload = {
        "category_id": "strength",
        "name": "修改過的深蹲",
        "body_region": "lower_body",
        "equipment": "barbell",
    }
    edited = await with_exercises.patch("/exercises/barbell-back-squat", json=payload)
    deleted = await with_exercises.delete("/exercises/barbell-back-squat")

    assert edited.status_code == 403
    assert deleted.status_code == 403
    assert (await with_exercises.get("/exercises", params={"q": "槓鈴深蹲"})).json()[0][
        "name"
    ] == "槓鈴深蹲"


async def test_editing_or_deleting_an_unknown_exercise_returns_not_found(signed_in: AsyncClient):
    payload = {"category_id": "strength", "name": "不存在的動作"}
    assert (await signed_in.patch("/exercises/missing", json=payload)).status_code == 404
    assert (await signed_in.delete("/exercises/missing")).status_code == 404


async def test_bodyweight_strength_can_replace_a_barbell_lift(with_exercises: AsyncClient):
    alternatives = (
        await with_exercises.get(
            "/exercises/barbell-back-squat/alternatives", params={"reason": "equipment"}
        )
    ).json()
    equipment = {item["exercise"]["equipment"] for item in alternatives}
    # Bodyweight work used to sit under mobility, which put it out of reach here: the
    # alternatives only ever come from the source exercise's own category.
    assert "bodyweight" in equipment


async def test_builtin_exercises_carry_a_met_and_custom_ones_do_not(with_exercises: AsyncClient):
    builtins = (await with_exercises.get("/exercises")).json()
    assert builtins
    assert all(item["met"] and item["met"] > 0 for item in builtins)

    custom = (
        await with_exercises.post("/exercises", json={"category_id": "strength", "name": "自訂"})
    ).json()
    assert custom["met"] is None
