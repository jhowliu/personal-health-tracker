import aiosqlite
from httpx import AsyncClient

from app.adapters.sqlite.foods import SqliteFoodStore
from app.config import settings
from app.db import get_conn


async def _food_count() -> int:
    async with aiosqlite.connect(settings.db_path) as conn:
        row = await (await conn.execute("SELECT COUNT(*) FROM foods")).fetchone()
    return row[0]


def _food(**overrides) -> dict:
    return {
        "category_id": "protein", "name": "測試食物", "state": "cooked",
        "kcal_per_100g": 100, "protein_per_100g": 10, "fat_per_100g": 1, "carb_per_100g": 1,
        "usual_grams": 100, "max_grams": 200, **overrides,
    }


async def test_seeding_defaults_twice_adds_nothing_the_second_time(with_foods: AsyncClient):
    async with aiosqlite.connect(settings.db_path) as conn:
        user_id = (await (await conn.execute("SELECT id FROM users")).fetchone())[0]
    before = await _food_count()

    async with get_conn() as conn:
        await SqliteFoodStore(conn).seed_defaults(user_id)

    assert await _food_count() == before


async def test_the_largest_portion_is_never_below_the_usual_one(with_foods: AsyncClient):
    created = await with_foods.post("/foods", json=_food(usual_grams=300, max_grams=100))
    assert created.status_code == 201
    assert created.json()["max_grams"] == 300

    edited = await with_foods.patch(
        f"/foods/{created.json()['id']}", json=_food(usual_grams=250, max_grams=50)
    )
    assert edited.json()["max_grams"] == 250
