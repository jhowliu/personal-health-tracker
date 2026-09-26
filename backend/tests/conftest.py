from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from scripts.migrate import apply
from seeds.exercises import seed as seed_exercises
from seeds.foods import seed as seed_foods


@pytest.fixture(autouse=True)
def isolate_ai_settings(monkeypatch) -> None:
    monkeypatch.setattr(settings, "openai_api_key", "")
    monkeypatch.setattr(settings, "jev_api_key", "")


@pytest.fixture
async def api(tmp_path, monkeypatch) -> AsyncIterator[AsyncClient]:
    db_path = str(tmp_path / "test.sqlite")
    monkeypatch.setattr(settings, "db_path", db_path)
    apply(db_path)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def signed_in(api: AsyncClient) -> AsyncClient:
    response = await api.post(
        "/auth/register", json={"email": "her@example.com", "password": "supersecret"}
    )
    assert response.status_code == 201, response.text
    api.headers["Authorization"] = f"Bearer {response.json()['access_token']}"
    return api


@pytest.fixture
async def with_profile(signed_in: AsyncClient) -> AsyncClient:
    response = await signed_in.put(
        "/users/me/profile",
        json={
            "sex": "f",
            "birth_date": "1995-01-01",
            "height_cm": 164,
            "weight_kg": 56,
            "activity_level": "sedentary",
            "deficit_pct": 12,
            "timezone": "Asia/Taipei",
        },
    )
    assert response.status_code == 200, response.text
    return signed_in


@pytest.fixture
async def with_foods(with_profile: AsyncClient) -> AsyncClient:
    """A profile plus the built-in food library — the starting point for P2 tests."""
    await seed_foods()
    return with_profile


@pytest.fixture
async def with_exercises(signed_in: AsyncClient) -> AsyncClient:
    """An authenticated user plus the built-in exercise catalog."""
    await seed_exercises()
    return signed_in


@pytest.fixture
async def with_meals(with_foods: AsyncClient) -> AsyncClient:
    """Three regular meals, enough for the planner to fill every slot without repeating."""
    recipes = [
        ("燕麥豆漿早餐", ["breakfast"], [("oats-raw", 30), ("soy-milk-unsweetened", 250)]),
        (
            "雞胸胡麻花椰飯",
            ["lunch", "dinner"],
            [("brown-rice-cooked", 120), ("chicken-breast-cooked", 100), ("broccoli-cooked", 150)],
        ),
        (
            "乾煎雞腿蛋花湯",
            ["lunch", "dinner"],
            [
                ("brown-rice-cooked", 100),
                ("chicken-thigh-skin-on-cooked", 100),
                ("egg", 50),
                ("zucchini-cooked", 100),
            ],
        ),
    ]
    for name, slots, items in recipes:
        response = await with_foods.post(
            "/meals",
            json={
                "name": name,
                "tag": "regular",
                "meal_times": slots,
                "items": [{"food_id": fid, "grams": g} for fid, g in items],
            },
        )
        assert response.status_code == 201, response.text
    return with_foods
