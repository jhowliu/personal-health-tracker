from dataclasses import replace
from datetime import UTC, date, datetime

import aiosqlite
from httpx import AsyncClient

import app.api.deps as deps
from app.adapters.sqlite.rows import to_iso
from app.config import settings
from app.domain.decisions import DecisionResult
from app.domain.meal_photos import EstimatedFood, Recognition, foods_for_prompt
from app.domain.models import Nutrients
from tests import factories
from tests.factories import seeded_food_id


class FakeStorage:
    async def create_upload_url(
        self, user_id: str, photo_id: str, content_type: str
    ) -> tuple[str, str]:
        extension = "jpg" if content_type == "image/jpeg" else "png"
        key = f"users/{user_id}/meal-photos/{photo_id}.{extension}"
        return key, f"https://storage.test/{key}"

    async def create_download_url(self, object_key: str) -> str:
        return f"https://storage.test/{object_key}"

    async def exists(self, object_key: str) -> bool:
        return True


class MissingObjectStorage(FakeStorage):
    async def exists(self, object_key: str) -> bool:
        return False


class FakeRecognizer:
    async def recognize(
        self, image_url: str, known_foods: tuple[str, ...]
    ) -> tuple[Recognition, ...]:
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


async def test_photo_analysis_rejects_an_upload_that_never_reached_storage(
    signed_in: AsyncClient, monkeypatch
):
    monkeypatch.setattr(deps, "object_storage", lambda: MissingObjectStorage())
    created = await signed_in.post("/meal-photos", json={"content_type": "image/jpeg"})

    analyzed = await signed_in.post(f"/meal-photos/{created.json()['id']}/analyze")

    assert analyzed.status_code == 422
    assert analyzed.json()["detail"] == "照片尚未完成上傳，請重新選擇照片"


async def test_photo_recognition_matches_visible_food_candidates(
    with_foods: AsyncClient, monkeypatch
):
    monkeypatch.setattr(deps, "object_storage", lambda: FakeStorage())
    monkeypatch.setattr(deps, "image_recognizer", lambda: FakeRecognizer())
    photo = await with_foods.post("/meal-photos", json={"content_type": "image/png"})

    analyzed = await with_foods.post(f"/meal-photos/{photo.json()['id']}/analyze")
    assert analyzed.status_code == 200
    item = analyzed.json()["items"][0]
    chicken = await seeded_food_id(with_foods, "chicken-breast-cooked")
    assert item["food_id"] == chicken
    assert item["category_id"] == "protein"
    assert item["alternatives"][0]["food_id"] == chicken


async def test_extras_calculate_known_food_and_preserve_custom_nutrition(
    with_foods: AsyncClient, monkeypatch
):
    monkeypatch.setattr(deps, "object_storage", lambda: FakeStorage())
    photo = await with_foods.post("/meal-photos", json={"content_type": "image/jpeg"})
    photo_id = photo.json()["id"]
    chicken = await seeded_food_id(with_foods, "chicken-breast-cooked")
    known = await with_foods.post(
        "/days/2026-09-23/meals/extras/items",
        json={"food_id": chicken, "grams": 100, "photo_id": photo_id},
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
        json={"food_id": chicken, "grams": 100, "photo_id": photo_id},
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


async def test_photographed_food_can_be_added_to_a_specific_meal_slot(
    with_meals: AsyncClient, monkeypatch
):
    monkeypatch.setattr(deps, "object_storage", lambda: FakeStorage())
    photo = await with_meals.post("/meal-photos", json={"content_type": "image/jpeg"})
    chicken = await seeded_food_id(with_meals, "chicken-breast-cooked")

    added = await with_meals.post(
        "/days/2026-09-23/plan/breakfast/items",
        json={
            "food_id": chicken,
            "grams": 100,
            "photo_id": photo.json()["id"],
        },
    )

    assert added.status_code == 201
    breakfast = next(
        meal for meal in added.json()["meals"] if meal["meal_time"] == "breakfast"
    )
    photographed = next(
        item for item in breakfast["items"] if item["photo_id"] == photo.json()["id"]
    )
    assert photographed["food"]["id"] == chicken
    assert photographed["nutrients"]["kcal"] == 165


async def plate_breakfast(client: AsyncClient, day: str) -> dict:
    """Put the saved breakfast on the day's plate, as the user would from 我的餐點."""
    meals = (await client.get("/meals")).json()
    meal_id = next(m["id"] for m in meals if m["name"] == "燕麥豆漿早餐")
    response = await client.post(f"/days/{day}/plan/breakfast/meal", json={"meal_id": meal_id})
    assert response.status_code == 201
    return response.json()


async def test_plan_snapshot_items_support_known_and_custom_crud(with_meals: AsyncClient):
    day = "2026-09-23"
    before = await plate_breakfast(with_meals, day)
    breakfast = next(meal for meal in before["meals"] if meal["meal_time"] == "breakfast")
    before_kcal = before["nutrients"]["kcal"]
    chicken = await seeded_food_id(with_meals, "chicken-breast-cooked")

    known = await with_meals.post(
        f"/days/{day}/plan/breakfast/items",
        json={"food_id": chicken, "grams": 100},
    )
    assert known.status_code == 201
    known_breakfast = next(
        meal for meal in known.json()["meals"] if meal["meal_time"] == "breakfast"
    )
    known_item = next(
        item
        for item in known_breakfast["items"]
        if item["food"] and item["food"]["id"] == chicken
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


async def test_editing_an_eaten_item_updates_the_day_nutrition_summary(
    with_meals: AsyncClient,
):
    day = "2026-09-23"
    plan = await plate_breakfast(with_meals, day)
    breakfast = next(meal for meal in plan["meals"] if meal["meal_time"] == "breakfast")
    item = breakfast["items"][0]
    await with_meals.patch(f"/days/{day}/meals/breakfast", json={"state": "eaten"})
    before = (await with_meals.get(f"/days/{day}")).json()["flow"]["eaten"]

    updated_plan = (
        await with_meals.patch(
            f"/days/{day}/plan/breakfast/items/{item['id']}",
            json={"grams": item["grams"] * 2},
        )
    ).json()
    updated_breakfast = next(
        meal for meal in updated_plan["meals"] if meal["meal_time"] == "breakfast"
    )
    updated_item = next(value for value in updated_breakfast["items"] if value["id"] == item["id"])
    after = (await with_meals.get(f"/days/{day}")).json()["flow"]["eaten"]

    assert round(after["kcal"] - before["kcal"], 1) == round(
        updated_item["nutrients"]["kcal"] - item["nutrients"]["kcal"], 1
    )


async def test_editing_an_added_food_updates_all_day_totals_even_with_legacy_cached_nutrients(
    with_meals: AsyncClient,
):
    day = "2026-09-23"
    chicken = await seeded_food_id(with_meals, "chicken-breast-cooked")
    added = await with_meals.post(
        f"/days/{day}/plan/breakfast/items",
        json={"food_id": chicken, "grams": 100},
    )
    assert added.status_code == 201
    original = next(
        item
        for meal in added.json()["meals"]
        if meal["meal_time"] == "breakfast"
        for item in meal["items"]
        if item["food"] and item["food"]["id"] == chicken
    )
    async with aiosqlite.connect(settings.db_path) as conn:
        stored = await (
            await conn.execute(
                "SELECT kcal, protein_g, fat_g, carb_g FROM day_meal_items WHERE id = ?",
                (original["id"],),
            )
        ).fetchone()
    assert stored == (None, None, None, None)
    await with_meals.patch(f"/days/{day}/meals/breakfast", json={"state": "eaten"})
    before = (await with_meals.get(f"/days/{day}")).json()["flow"]["eaten"]

    updated = await with_meals.patch(
        f"/days/{day}/plan/breakfast/items/{original['id']}", json={"grams": 200}
    )
    assert updated.status_code == 200
    changed = next(
        item
        for meal in updated.json()["meals"]
        for item in meal["items"]
        if item["id"] == original["id"]
    )

    for nutrient in ("kcal", "protein_g", "fat_g", "carb_g"):
        expected_delta = changed["nutrients"][nutrient] - original["nutrients"][nutrient]
        actual_delta = (await with_meals.get(f"/days/{day}")).json()["flow"]["eaten"][
            nutrient
        ] - before[nutrient]
        assert round(actual_delta, 1) == round(expected_delta, 1)

    # Existing installs may still contain the originally cached per-item nutrients.
    async with aiosqlite.connect(settings.db_path) as conn:
        await conn.execute(
            "UPDATE day_meal_items SET kcal = ?, protein_g = ?, fat_g = ?, carb_g = ?,"
            " nutrition_snapshot_grams = NULL"
            " WHERE id = ?",
            (
                original["nutrients"]["kcal"],
                original["nutrients"]["protein_g"],
                original["nutrients"]["fat_g"],
                original["nutrients"]["carb_g"],
                original["id"],
            ),
        )
        await conn.commit()
    legacy = (await with_meals.get(f"/days/{day}")).json()["flow"]["eaten"]
    for nutrient in ("kcal", "protein_g", "fat_g", "carb_g"):
        expected_delta = changed["nutrients"][nutrient] - original["nutrients"][nutrient]
        assert round(legacy[nutrient] - before[nutrient], 1) == round(expected_delta, 1)


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

    async def recognize(
        self, image_url: str, known_foods: tuple[str, ...]
    ) -> tuple[Recognition, ...]:
        return (Recognition("雞", 120, 0.91),)


class LastOptionEngine:
    async def decide(self, request) -> DecisionResult:
        return DecisionResult(request.options[-1].id, 0.93, "picked the last option")


class UnsureDecisionEngine:
    async def decide(self, request) -> DecisionResult:
        return DecisionResult(request.options[0].id, 0.3, "not sure")


class UnexpectedDecisionEngine:
    async def decide(self, request) -> DecisionResult:
        raise AssertionError("exact local matches must not call the decision engine")


class ExactRecognizer:
    async def recognize(
        self, image_url: str, known_foods: tuple[str, ...]
    ) -> tuple[Recognition, ...]:
        return (Recognition("香蕉", 120, 0.91),)


class NewFoodRecognizer:
    async def recognize(
        self, image_url: str, known_foods: tuple[str, ...]
    ) -> tuple[Recognition, ...]:
        return (
            Recognition(
                "火龍果",
                180,
                0.88,
                EstimatedFood("fruit", Nutrients(50, 1.1, 0.2, 11)),
            ),
        )


class PairingRecognizer:
    """Says what it saw and, separately, which library food that is, like the real prompt."""

    def __init__(self, *recognitions: Recognition) -> None:
        self.recognitions = recognitions
        self.known_foods: tuple[str, ...] = ()

    async def recognize(
        self, image_url: str, known_foods: tuple[str, ...]
    ) -> tuple[Recognition, ...]:
        self.known_foods = known_foods
        return self.recognitions


async def analyze_with(client: AsyncClient, monkeypatch, recognizer) -> dict:
    monkeypatch.setattr(deps, "object_storage", lambda: FakeStorage())
    monkeypatch.setattr(deps, "image_recognizer", lambda: recognizer)
    monkeypatch.setattr(deps, "decision_engine", lambda: UnexpectedDecisionEngine())
    photo = await client.post("/meal-photos", json={"content_type": "image/png"})
    analyzed = await client.post(f"/meal-photos/{photo.json()['id']}/analyze")
    assert analyzed.status_code == 200
    return analyzed.json()


async def test_photo_pairing_is_only_as_sure_as_the_recognizer_says(
    with_foods: AsyncClient, monkeypatch
):
    seen = EstimatedFood("protein", Nutrients(190, 27, 9, 0))
    recognizer = PairingRecognizer(
        Recognition("豬肉片", 100, 0.85, seen, library_name="梅花豬(熟)", library_confidence=0.7)
    )

    item = (await analyze_with(with_foods, monkeypatch, recognizer))["items"][0]

    library = {food["name"] for food in (await with_foods.get("/foods")).json()}
    assert set(recognizer.known_foods) == library
    assert item["label"] == "豬肉片"
    assert item["food_id"] == await seeded_food_id(with_foods, "pork-collar-cooked")
    # Not 1.0: a forced near miss has to keep asking the user to confirm.
    assert item["match_confidence"] == 0.7
    # What was actually seen stays available, for when the pairing is wrong.
    assert item["estimate"]["kcal_per_100g"] == 190


async def test_photo_pairing_with_a_name_outside_the_library_falls_back_to_search(
    with_foods: AsyncClient, monkeypatch
):
    recognizer = PairingRecognizer(
        Recognition("香蕉", 120, 0.9, library_name="不存在的香蕉", library_confidence=0.9)
    )

    item = (await analyze_with(with_foods, monkeypatch, recognizer))["items"][0]

    assert item["food_id"] == await seeded_food_id(with_foods, "banana")
    assert item["match_confidence"] == 1.0


async def test_photo_recognizer_sees_recently_logged_foods_first(
    with_foods: AsyncClient, monkeypatch
):
    salmon = await seeded_food_id(with_foods, "salmon-cooked")
    logged = await with_foods.post(
        f"/days/{date.today().isoformat()}/meals/extras/items",
        json={"food_id": salmon, "grams": 100},
    )
    assert logged.status_code == 201
    recognizer = PairingRecognizer(Recognition("香蕉", 120, 0.9))

    await analyze_with(with_foods, monkeypatch, recognizer)

    assert recognizer.known_foods[0] == "鮭魚(熟)"


def test_prompt_foods_put_recent_then_defaults_first_and_stop_at_the_limit():
    custom = factories.food("custom", kcal=100, name="自己的便當")
    default = replace(factories.food("default", kcal=100, name="白飯(熟)"), template_id="rice")
    recent = factories.food("recent", kcal=100, name="鮭魚(熟)")
    twin = factories.food("twin", kcal=100, name="白飯(熟)")

    names = foods_for_prompt((custom, default, recent, twin), ("recent", "gone"))

    assert names == ("鮭魚(熟)", "白飯(熟)", "自己的便當")
    assert foods_for_prompt((custom, default, recent), ("recent",), limit=2) == (
        "鮭魚(熟)",
        "白飯(熟)",
    )


async def test_photo_exact_local_match_skips_the_decision_layer(
    with_foods: AsyncClient, monkeypatch
):
    monkeypatch.setattr(deps, "object_storage", lambda: FakeStorage())
    monkeypatch.setattr(deps, "image_recognizer", lambda: ExactRecognizer())
    monkeypatch.setattr(deps, "decision_engine", lambda: UnexpectedDecisionEngine())

    photo = await with_foods.post("/meal-photos", json={"content_type": "image/png"})
    analyzed = await with_foods.post(f"/meal-photos/{photo.json()['id']}/analyze")

    assert analyzed.status_code == 200
    item = analyzed.json()["items"][0]
    assert item["food_id"] == await seeded_food_id(with_foods, "banana")
    assert item["recognition_confidence"] == 0.91
    assert item["match_confidence"] == 1.0


async def test_photo_unmatched_food_returns_an_estimate_for_confirmation(
    with_foods: AsyncClient, monkeypatch
):
    monkeypatch.setattr(deps, "object_storage", lambda: FakeStorage())
    monkeypatch.setattr(deps, "image_recognizer", lambda: NewFoodRecognizer())

    photo = await with_foods.post("/meal-photos", json={"content_type": "image/png"})
    analyzed = await with_foods.post(f"/meal-photos/{photo.json()['id']}/analyze")

    assert analyzed.status_code == 200
    item = analyzed.json()["items"][0]
    assert item["food_id"] is None
    assert item["recognition_confidence"] == 0.88
    assert item["estimate"] == {
        "category_id": "fruit",
        "kcal_per_100g": 50.0,
        "protein_per_100g": 1.1,
        "fat_per_100g": 0.2,
        "carb_per_100g": 11.0,
    }


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
    assert item["recognition_confidence"] == 0.91
    assert item["match_confidence"] == 0.93
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
    assert item["recognition_confidence"] == 0.91
    assert item["match_confidence"] == 0.0
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


async def test_photographed_extras_count_towards_what_was_eaten(
    with_foods: AsyncClient, monkeypatch
):
    monkeypatch.setattr(deps, "object_storage", lambda: FakeStorage())
    before = (await with_foods.get("/days/2026-09-23")).json()["flow"]["eaten"]
    chicken = await seeded_food_id(with_foods, "chicken-breast-cooked")

    added = await with_foods.post(
        "/days/2026-09-23/meals/extras/items",
        json={"food_id": chicken, "grams": 100},
    )
    assert added.status_code == 201

    after = (await with_foods.get("/days/2026-09-23")).json()["flow"]["eaten"]
    # Extras are recorded after the fact, so there is no "mark eaten" step to wait for.
    assert after["kcal"] - before["kcal"] == 165
    assert after["protein_g"] - before["protein_g"] == 31


class WritingRecognizer:
    """Logs a weigh-in while the model is "thinking", the way another request would."""

    def __init__(self, client: AsyncClient) -> None:
        self.client = client
        self.write_status: int | None = None

    async def recognize(
        self, image_url: str, known_foods: tuple[str, ...]
    ) -> tuple[Recognition, ...]:
        logged = await self.client.put(
            f"/body-logs/{date.today().isoformat()}", json={"weight_kg": 56}
        )
        self.write_status = logged.status_code
        return (Recognition("香蕉", 120, 0.9),)


async def test_other_writes_go_through_while_a_photo_is_being_recognized(
    with_foods: AsyncClient, monkeypatch
):
    recognizer = WritingRecognizer(with_foods)

    await analyze_with(with_foods, monkeypatch, recognizer)

    # The model call must not run inside the request's write transaction.
    assert recognizer.write_status == 200


async def mark_analyzing(photo_id: str, started: str) -> None:
    async with aiosqlite.connect(settings.db_path) as conn:
        await conn.execute(
            "UPDATE meal_photos SET status = 'analyzing', analyzed_at = ? WHERE id = ?",
            (started, photo_id),
        )
        await conn.commit()


async def test_photo_analysis_cannot_start_twice_but_a_stale_one_can_be_retried(
    with_foods: AsyncClient, monkeypatch
):
    monkeypatch.setattr(deps, "object_storage", lambda: FakeStorage())
    monkeypatch.setattr(deps, "image_recognizer", lambda: ExactRecognizer())
    photo = await with_foods.post("/meal-photos", json={"content_type": "image/png"})
    photo_id = photo.json()["id"]

    await mark_analyzing(photo_id, to_iso(datetime.now(UTC)))
    running = await with_foods.post(f"/meal-photos/{photo_id}/analyze")
    assert running.status_code == 422

    # A server that died mid-analysis leaves the claim behind; it lapses after a while.
    await mark_analyzing(photo_id, "2020-01-01T00:00:00.000Z")
    retried = await with_foods.post(f"/meal-photos/{photo_id}/analyze")
    assert retried.status_code == 200
