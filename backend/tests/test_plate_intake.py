"""One intake rule for the plan and for Extras, and one definition of the planned slots."""

from typing import get_args

from httpx import AsyncClient

from app.adapters.sqlite.day_row import PLANNED_MEALS
from app.api.schemas import PlannedSlot
from app.domain.models import PLANNED_SLOTS
from tests.factories import seeded_food_id

DAY = "2026-09-22"
RICE = "brown-rice-cooked"


async def test_plan_and_extras_turn_away_the_same_bad_input_the_same_way(
    with_foods: AsyncClient,
):
    rice = await seeded_food_id(with_foods, RICE)
    bad_inputs = [
        {"food_id": rice, "grams": 100, "photo_id": "no-such-photo"},
        {"food_id": "no-such-food", "grams": 100},
    ]

    for body in bad_inputs:
        plan = await with_foods.post(f"/days/{DAY}/plan/lunch/items", json=body)
        extra = await with_foods.post(f"/days/{DAY}/meals/extras/items", json=body)

        assert plan.status_code == extra.status_code == 404
        assert plan.json()["detail"] == extra.json()["detail"]


async def test_a_known_food_is_frozen_as_an_extra_but_follows_the_food_in_a_plan(
    with_foods: AsyncClient,
):
    rice_id = await seeded_food_id(with_foods, RICE)
    rice = (await with_foods.get(f"/foods/{rice_id}")).json()

    extra = await with_foods.post(
        f"/days/{DAY}/meals/extras/items", json={"food_id": rice_id, "grams": 100}
    )
    planned = await with_foods.post(
        f"/days/{DAY}/plan/lunch/items", json={"food_id": rice_id, "grams": 100}
    )
    assert extra.status_code == 201 and planned.status_code == 201
    before = extra.json()["nutrients"]["kcal"]

    edited = await with_foods.patch(
        f"/foods/{rice_id}",
        json={
            "category_id": rice["category_id"], "name": rice["name"], "state": rice["state"],
            "kcal_per_100g": 300, "protein_per_100g": 5, "fat_per_100g": 1,
            "carb_per_100g": 60, "usual_grams": 120, "max_grams": 250,
        },
    )
    assert edited.status_code == 200
    assert before != 300

    plan = (await with_foods.get(f"/days/{DAY}/plan")).json()
    assert plan["extras"][0]["nutrients"]["kcal"] == before
    lunch = next(m for m in plan["meals"] if m["meal_time"] == "lunch")
    assert lunch["items"][-1]["nutrients"]["kcal"] == 300


async def test_the_planned_slots_are_defined_once(with_foods: AsyncClient):
    wire = {slot.value for slot in PLANNED_SLOTS}

    assert set(get_args(PlannedSlot)) == wire
    assert set(PLANNED_MEALS) == wire

    for path in (
        f"/days/{DAY}/plan/extras/items",
        f"/days/{DAY}/plan/extras/items/x",
    ):
        rejected = await with_foods.post(path, json={"custom_name": "x", "nutrients": _zero()})
        assert rejected.status_code in (405, 422)
    assert (await with_foods.patch(f"/days/{DAY}/meals/extras")).status_code == 422


def _zero() -> dict:
    return {"kcal": 0, "protein_g": 0, "fat_g": 0, "carb_g": 0}
