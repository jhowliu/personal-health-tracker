import aiosqlite
from httpx import AsyncClient

import app.api.deps as deps
from app.config import settings
from app.domain.decisions import DecisionResult
from app.domain.meal_photos import Recognition


class FakeStorage:
    async def create_upload_url(
        self, user_id: str, photo_id: str, content_type: str
    ) -> tuple[str, str]:
        extension = "jpg" if content_type == "image/jpeg" else "png"
        key = f"users/{user_id}/meal-photos/{photo_id}.{extension}"
        return key, f"https://storage.test/{key}"

    async def create_download_url(self, object_key: str) -> str:
        return f"https://storage.test/{object_key}"


class FakeRecognizer:
    async def recognize(self, image_url: str) -> tuple[Recognition, ...]:
        assert image_url.startswith("https://storage.test/users/")
        return (Recognition("雞胸", 120, 0.91),)


class InvalidDecisionEngine:
    async def decide(self, request) -> DecisionResult:
        assert request.options
        return DecisionResult("invented-category", 0.9, "untrusted")


async def test_photo_ownership_and_missing_ai_key_return_safe_errors(
    signed_in: AsyncClient, monkeypatch
):
    monkeypatch.setattr(deps, "object_storage", lambda: FakeStorage())
    created = await signed_in.post("/meal-photos", json={"content_type": "image/jpeg"})
    assert created.status_code == 201
    photo_id = created.json()["id"]
    assert created.json()["object_key"].startswith("users/")

    failed = await signed_in.post(f"/meal-photos/{photo_id}/analyze")
    assert failed.status_code == 503
    assert "AI" in failed.json()["detail"]

    async with aiosqlite.connect(settings.db_path) as conn:
        status = await (
            await conn.execute("SELECT status FROM meal_photos WHERE id = ?", (photo_id,))
        ).fetchone()
    assert status == ("failed",)

    other = await signed_in.post(
        "/auth/register", json={"email": "other@example.com", "password": "supersecret"}
    )
    signed_in.headers["Authorization"] = f"Bearer {other.json()['access_token']}"
    assert (await signed_in.post(f"/meal-photos/{photo_id}/analyze")).status_code == 404


async def test_photo_recognition_matches_visible_food_candidates(
    with_foods: AsyncClient, monkeypatch
):
    monkeypatch.setattr(deps, "object_storage", lambda: FakeStorage())
    monkeypatch.setattr(deps, "image_recognizer", lambda: FakeRecognizer())
    photo = await with_foods.post("/meal-photos", json={"content_type": "image/png"})

    analyzed = await with_foods.post(f"/meal-photos/{photo.json()['id']}/analyze")
    assert analyzed.status_code == 200
    item = analyzed.json()["items"][0]
    assert item["food_id"] == "chicken-breast-cooked"
    assert item["category_id"] == "protein"
    assert item["alternatives"][0]["food_id"] == "chicken-breast-cooked"


async def test_extras_calculate_known_food_and_preserve_custom_nutrition(
    with_foods: AsyncClient, monkeypatch
):
    monkeypatch.setattr(deps, "object_storage", lambda: FakeStorage())
    photo = await with_foods.post("/meal-photos", json={"content_type": "image/jpeg"})
    photo_id = photo.json()["id"]
    known = await with_foods.post(
        "/days/2026-09-23/meals/extras/items",
        json={"food_id": "chicken-breast-cooked", "grams": 100, "photo_id": photo_id},
    )
    assert known.status_code == 201
    assert known.json()["nutrients"]["kcal"] == 165

    custom = await with_foods.post(
        "/days/2026-09-23/meals/extras/items",
        json={
            "custom_name": "手搖飲",
            "nutrients": {"kcal": 180, "protein_g": 2, "fat_g": 1, "carb_g": 40},
        },
    )
    assert custom.status_code == 201

    other = await with_foods.post(
        "/auth/register", json={"email": "photo-owner@example.com", "password": "supersecret"}
    )
    with_foods.headers["Authorization"] = f"Bearer {other.json()['access_token']}"
    unowned_photo = await with_foods.post(
        "/days/2026-09-23/meals/extras/items",
        json={"food_id": "chicken-breast-cooked", "grams": 100, "photo_id": photo_id},
    )
    assert unowned_photo.status_code == 404

    # Restore the owner before reading and deleting its confirmed extras.
    login = await with_foods.post(
        "/auth/login", json={"email": "her@example.com", "password": "supersecret"}
    )
    with_foods.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
    plan = await with_foods.get("/days/2026-09-23/plan")
    assert {item["id"] for item in plan.json()["extras"]} == {
        known.json()["id"],
        custom.json()["id"],
    }
    assert plan.json()["nutrients"]["kcal"] == 345
    assert (
        await with_foods.delete(f"/days/2026-09-23/meals/extras/items/{custom.json()['id']}")
    ).status_code == 204


async def test_plan_snapshot_items_support_known_and_custom_crud(with_meals: AsyncClient):
    day = "2026-09-23"
    before = (await with_meals.get(f"/days/{day}/plan")).json()
    breakfast = next(meal for meal in before["meals"] if meal["meal_time"] == "breakfast")
    before_kcal = before["nutrients"]["kcal"]

    known = await with_meals.post(
        f"/days/{day}/plan/breakfast/items",
        json={"food_id": "chicken-breast-cooked", "grams": 100},
    )
    assert known.status_code == 201
    known_breakfast = next(
        meal for meal in known.json()["meals"] if meal["meal_time"] == "breakfast"
    )
    known_item = next(
        item
        for item in known_breakfast["items"]
        if item["food"] and item["food"]["id"] == "chicken-breast-cooked"
    )

    custom = await with_meals.post(
        f"/days/{day}/plan/breakfast/items",
        json={
            "custom_name": "手搖飲",
            "nutrients": {"kcal": 180, "protein_g": 2, "fat_g": 1, "carb_g": 40},
        },
    )
    assert custom.status_code == 201
    custom_breakfast = next(
        meal for meal in custom.json()["meals"] if meal["meal_time"] == "breakfast"
    )
    custom_item = next(
        item
        for item in custom_breakfast["items"]
        if item["custom_name"] == "手搖飲"
    )
    assert custom_item["nutrients"]["kcal"] == 180

    updated = await with_meals.patch(
        f"/days/{day}/plan/breakfast/items/{known_item['id']}", json={"grams": 150}
    )
    assert updated.status_code == 200
    assert (await with_meals.patch(
        f"/days/{day}/plan/breakfast/items/{custom_item['id']}", json={"grams": 150}
    )).status_code == 422
    assert (await with_meals.delete(
        f"/days/{day}/plan/breakfast/items/{known_item['id']}"
    )).status_code == 204

    await with_meals.patch(f"/days/{day}/meals/breakfast", json={"state": "skipped"})
    skipped = (await with_meals.get(f"/days/{day}/plan")).json()
    assert skipped["nutrients"]["kcal"] < before_kcal + 180
    assert breakfast["meal_id"] == next(
        meal for meal in skipped["meals"] if meal["meal_time"] == "breakfast"
    )["meal_id"]


async def test_suggestions_reject_model_created_category_ids(with_foods: AsyncClient, monkeypatch):
    monkeypatch.setattr(deps, "decision_engine", lambda: InvalidDecisionEngine())

    suggestion = await with_foods.post("/foods/suggest-category", json={"subject": "雞胸肉"})
    assert suggestion.status_code == 200
    assert suggestion.json()["category_id"] is None
    assert suggestion.json()["fallback_used"] is True


async def test_suggestions_without_an_ai_key_are_unavailable(with_foods: AsyncClient):
    response = await with_foods.post("/foods/suggest-category", json={"subject": "雞胸肉"})
    assert response.status_code == 503
    assert "AI" in response.json()["detail"]


async def test_exercise_alternatives_are_category_safe_and_deterministic(
    with_exercises: AsyncClient,
):
    alternatives = await with_exercises.get(
        "/exercises/barbell-back-squat/alternatives", params={"reason": "equipment"}
    )
    assert alternatives.status_code == 200
    assert alternatives.json()
    assert all(item["exercise"]["id"] != "barbell-back-squat" for item in alternatives.json())
    assert all(item["exercise"]["category_id"] == "strength" for item in alternatives.json())
    assert alternatives.json()[0]["exercise"]["body_region"] == "lower_body"


class BroadRecognizer:
    """A label that several library foods could answer, so there is a real choice to make."""

    async def recognize(self, image_url: str) -> tuple[Recognition, ...]:
        return (Recognition("雞", 120, 0.91),)


class LastOptionEngine:
    async def decide(self, request) -> DecisionResult:
        return DecisionResult(request.options[-1].id, 0.93, "picked the last option")


class UnsureDecisionEngine:
    async def decide(self, request) -> DecisionResult:
        return DecisionResult(request.options[0].id, 0.3, "not sure")


async def test_photo_match_follows_the_decision_layer_not_the_first_search_hit(
    with_foods: AsyncClient, monkeypatch
):
    monkeypatch.setattr(deps, "object_storage", lambda: FakeStorage())
    monkeypatch.setattr(deps, "image_recognizer", lambda: BroadRecognizer())
    monkeypatch.setattr(deps, "decision_engine", lambda: LastOptionEngine())
    candidates = (await with_foods.get("/foods", params={"q": "雞"})).json()
    assert len(candidates) > 1

    photo = await with_foods.post("/meal-photos", json={"content_type": "image/png"})
    analyzed = await with_foods.post(f"/meal-photos/{photo.json()['id']}/analyze")
    assert analyzed.status_code == 200

    item = analyzed.json()["items"][0]
    assert item["food_id"] == candidates[:10][-1]["id"]
    assert item["food_id"] != candidates[0]["id"]
    # Confidence now describes the food match, not the image model's 0.91 for the label.
    assert item["confidence"] == 0.93
    # The screen looks the selected food up inside alternatives, so it has to lead them.
    assert item["alternatives"][0]["food_id"] == item["food_id"]


async def test_photo_match_falls_back_to_the_best_hit_when_the_pick_is_unusable(
    with_foods: AsyncClient, monkeypatch
):
    monkeypatch.setattr(deps, "object_storage", lambda: FakeStorage())
    monkeypatch.setattr(deps, "image_recognizer", lambda: BroadRecognizer())
    monkeypatch.setattr(deps, "decision_engine", lambda: InvalidDecisionEngine())
    candidates = (await with_foods.get("/foods", params={"q": "雞"})).json()

    photo = await with_foods.post("/meal-photos", json={"content_type": "image/png"})
    analyzed = await with_foods.post(f"/meal-photos/{photo.json()['id']}/analyze")
    assert analyzed.status_code == 200

    item = analyzed.json()["items"][0]
    # Still pre-filled, but at zero confidence so the screen asks the user to confirm.
    assert item["food_id"] == candidates[0]["id"]
    assert item["confidence"] == 0.0
    assert item["alternatives"]


async def test_exercise_alternatives_promote_the_decision_layer_pick(
    with_exercises: AsyncClient, monkeypatch
):
    monkeypatch.setattr(deps, "decision_engine", lambda: LastOptionEngine())
    alternatives = (
        await with_exercises.get(
            "/exercises/barbell-back-squat/alternatives", params={"reason": "pain"}
        )
    ).json()
    assert len(alternatives) > 1
    # Deterministically the lower-body options lead; the chosen one overrides that.
    assert alternatives[0]["exercise"]["body_region"] != "lower_body"
    assert alternatives[0]["recommended"] is True
    assert all(item["recommended"] is False for item in alternatives[1:])


async def test_unsure_alternatives_keep_the_deterministic_order(
    with_exercises: AsyncClient, monkeypatch
):
    monkeypatch.setattr(deps, "decision_engine", lambda: UnsureDecisionEngine())
    alternatives = (
        await with_exercises.get(
            "/exercises/barbell-back-squat/alternatives", params={"reason": "equipment"}
        )
    ).json()
    assert alternatives[0]["exercise"]["body_region"] == "lower_body"
    # The same-region rule flags several, unlike a decision which flags exactly one.
    assert sum(1 for item in alternatives if item["recommended"]) > 1
