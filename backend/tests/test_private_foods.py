from httpx import AsyncClient

from app.db import get_conn
from seeds.foods import FOODS, seed
from seeds.sample_meals import seed as seed_sample_meals


async def test_each_account_gets_editable_defaults_and_only_missing_templates_are_added(
    with_foods: AsyncClient,
):
    first = (await with_foods.get("/foods")).json()
    assert len(first) == len(FOODS)
    chicken = next(food for food in first if food["template_id"] == "chicken-breast-cooked")
    assert chicken["id"] != chicken["template_id"]

    updated = await with_foods.patch(
        f"/foods/{chicken['id']}",
        json={
            "category_id": chicken["category_id"], "name": "我的雞胸肉", "state": chicken["state"],
            "kcal_per_100g": 215, "protein_per_100g": 31, "fat_per_100g": 3.6,
            "carb_per_100g": 0, "usual_grams": 100, "max_grams": 200,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["template_id"] == "chicken-breast-cooked"
    assert await seed() == len(FOODS)
    assert (await with_foods.get(f"/foods/{chicken['id']}")).json()["name"] == "我的雞胸肉"

    registered = await with_foods.post(
        "/auth/register", json={"email": "another@example.com", "password": "supersecret"}
    )
    with_foods.headers["Authorization"] = f"Bearer {registered.json()['access_token']}"
    second = (await with_foods.get("/foods")).json()
    assert len(second) == len(FOODS)
    assert (await with_foods.get(f"/foods/{chicken['id']}")).status_code == 404
    assert next(food for food in second if food["template_id"] == "chicken-breast-cooked")[
        "name"
    ] == "雞胸肉(熟)"


async def test_archived_food_remains_in_meals_and_does_not_return_on_reseed(
    with_foods: AsyncClient,
):
    chicken = next(
        food for food in (await with_foods.get("/foods")).json()
        if food["template_id"] == "chicken-breast-cooked"
    )
    meal = await with_foods.post(
        "/meals",
        json={"name": "雞胸餐", "meal_times": ["breakfast"],
              "items": [{"food_id": chicken["id"], "grams": 100}]},
    )
    assert meal.status_code == 201
    assert (await with_foods.delete(f"/foods/{chicken['id']}")).status_code == 204
    assert (await with_foods.get(f"/foods/{chicken['id']}")).status_code == 404
    await seed()
    assert all(
        food["template_id"] != chicken["template_id"]
        for food in (await with_foods.get("/foods")).json()
    )
    assert (await with_foods.get(f"/meals/{meal.json()['id']}")).json()["items"][0]["food"][
        "id"
    ] == chicken["id"]
    renamed = await with_foods.patch(f"/meals/{meal.json()['id']}", json={"name": "保留雞胸餐"})
    assert renamed.status_code == 200
    assert renamed.json()["items"][0]["food"]["id"] == chicken["id"]
    rejected = await with_foods.post(
        "/meals", json={"name": "新餐", "meal_times": ["lunch"],
                        "items": [{"food_id": chicken["id"], "grams": 100}]},
    )
    assert rejected.status_code == 404
    plated = await with_foods.post(
        "/days/2026-09-23/plan/breakfast/meal", json={"meal_id": meal.json()["id"]}
    )
    assert plated.json()["meals"][0]["items"][0]["food"]["id"] == chicken["id"]


async def test_eaten_nutrition_stays_fixed_when_food_changes_but_new_meals_use_new_values(
    with_foods: AsyncClient,
):
    chicken = next(
        food for food in (await with_foods.get("/foods")).json()
        if food["template_id"] == "chicken-breast-cooked"
    )
    meal = await with_foods.post(
        "/meals",
        json={"name": "雞胸餐", "meal_times": ["breakfast"],
              "items": [{"food_id": chicken["id"], "grams": 100}]},
    )
    assert meal.status_code == 201
    old_day = "2026-09-22"
    plan = (
        await with_foods.post(
            f"/days/{old_day}/plan/breakfast/meal", json={"meal_id": meal.json()["id"]}
        )
    ).json()
    item_id = plan["meals"][0]["items"][0]["id"]
    await with_foods.patch(f"/days/{old_day}/meals/breakfast", json={"state": "eaten"})

    changed = await with_foods.patch(
        f"/foods/{chicken['id']}",
        json={
            "category_id": chicken["category_id"],
            "name": "較高熱量雞胸",
            "state": chicken["state"],
            "kcal_per_100g": 220, "protein_per_100g": 35, "fat_per_100g": 7,
            "carb_per_100g": 1, "usual_grams": 100, "max_grams": 200,
        },
    )
    assert changed.status_code == 200
    assert (await with_foods.get(f"/meals/{meal.json()['id']}")).json()["nutrients"]["kcal"] == 220
    assert (await with_foods.get(f"/days/{old_day}")).json()["flow"]["eaten"]["kcal"] == 165
    old_plan = (await with_foods.get(f"/days/{old_day}/plan")).json()
    assert old_plan["meals"][0]["nutrients"]["kcal"] == 165

    portion = await with_foods.patch(
        f"/days/{old_day}/plan/breakfast/items/{item_id}", json={"grams": 200}
    )
    assert portion.status_code == 200
    assert (await with_foods.get(f"/days/{old_day}")).json()["flow"]["eaten"]["kcal"] == 330
    old_plan = (await with_foods.get(f"/days/{old_day}/plan")).json()
    assert old_plan["meals"][0]["nutrients"]["kcal"] == 330
    new_day = await with_foods.post(
        "/days/2026-09-23/plan/breakfast/meal", json={"meal_id": meal.json()["id"]}
    )
    assert new_day.json()["meals"][0]["nutrients"]["kcal"] == 220


async def test_existing_templates_can_be_added_without_replacing_existing_copies(
    with_foods: AsyncClient,
):
    async with get_conn() as conn:
        await conn.execute(
            "INSERT INTO food_templates (id, category_id, name, kcal_per_100g,"
            " protein_per_100g, fat_per_100g, carb_per_100g, usual_grams, max_grams)"
            " VALUES ('new-default', 'fruit', '新水果', 50, 1, 0, 10, 100, 200)"
        )
    await seed()
    assert len([
        food for food in (await with_foods.get("/foods")).json()
        if food["template_id"] == "new-default"
    ]) == 1


async def test_sample_meals_use_the_accounts_foods(with_foods: AsyncClient):
    created = await seed_sample_meals("her@example.com")
    assert created == {"her@example.com": 7}
    meals = (await with_foods.get("/meals")).json()
    assert len(meals) == 7
    assert all(item["food"]["id"] != item["food"]["template_id"]
               for meal in meals for item in meal["items"])
