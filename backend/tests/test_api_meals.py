from httpx import AsyncClient

from tests.factories import seeded_food_id

TODAY = "2026-09-22"


async def test_meal_round_trip(with_foods: AsyncClient):
    rice = await seeded_food_id(with_foods, "brown-rice-cooked")
    chicken = await seeded_food_id(with_foods, "chicken-breast-cooked")
    broccoli = await seeded_food_id(with_foods, "broccoli-cooked")
    created = await with_foods.post(
        "/meals",
        json={
            "name": "雞胸胡麻花椰飯",
            "meal_times": ["lunch", "dinner"],
            "items": [
                {"food_id": rice, "grams": 120},
                {"food_id": chicken, "grams": 100},
                {"food_id": broccoli, "grams": 150},
            ],
        },
    )
    assert created.status_code == 201
    meal = created.json()

    assert meal["meal_times"] == ["dinner", "lunch"]
    assert len(meal["items"]) == 3
    # rice 132 + breast 165 + broccoli 37.5
    assert meal["nutrients"]["kcal"] == 334.5

    assert (await with_foods.delete(f"/meals/{meal['id']}")).status_code == 204
    assert (await with_foods.get("/meals")).json() == []


async def test_items_carry_their_category_so_the_editor_can_group_them(with_meals: AsyncClient):
    meal = next(m for m in (await with_meals.get("/meals")).json() if m["name"].endswith("花椰飯"))

    categories = [i["category_id"] for i in meal["items"]]
    assert categories == ["staple", "protein", "vegetable"]


async def test_filtering_by_slot(with_meals: AsyncClient):
    breakfasts = (await with_meals.get("/meals?meal_time=breakfast")).json()

    assert [m["name"] for m in breakfasts] == ["燕麥豆漿早餐"]


async def test_searching_by_name(with_meals: AsyncClient):
    found = (await with_meals.get("/meals?q=雞腿")).json()
    assert [m["name"] for m in found] == ["乾煎雞腿蛋花湯"]


async def test_editing_replaces_the_items(with_meals: AsyncClient):
    meal = (await with_meals.get("/meals?meal_time=breakfast")).json()[0]
    banana = await seeded_food_id(with_meals, "banana")

    updated = await with_meals.patch(
        f"/meals/{meal['id']}",
        json={"items": [{"food_id": banana, "grams": 100}]},
    )

    assert updated.status_code == 200
    assert [i["food"]["id"] for i in updated.json()["items"]] == [banana]
    assert updated.json()["name"] == meal["name"], "untouched fields stay put"


async def test_unknown_food_is_rejected(with_foods: AsyncClient):
    response = await with_foods.post(
        "/meals",
        json={
            "name": "壞掉的餐點",
            "meal_times": ["lunch"],
            "items": [{"food_id": "does-not-exist", "grams": 100}],
        },
    )
    assert response.status_code == 404


class TestCalculate:
    async def test_totals_without_saving(self, with_foods: AsyncClient):
        rice = await seeded_food_id(with_foods, "brown-rice-cooked")
        chicken = await seeded_food_id(with_foods, "chicken-breast-cooked")
        response = await with_foods.post(
            "/meals/calculate",
            json={
                "items": [
                    {"food_id": rice, "grams": 120},
                    {"food_id": chicken, "grams": 100},
                ]
            },
        )

        assert response.json()["kcal"] == 297.0
        assert (await with_foods.get("/meals")).json() == [], "nothing was stored"

    async def test_empty_draft_totals_zero(self, with_foods: AsyncClient):
        response = await with_foods.post("/meals/calculate", json={"items": []})
        assert response.json()["kcal"] == 0


async def saved_meal_id(client: AsyncClient, name: str) -> str:
    return next(m["id"] for m in (await client.get("/meals")).json() if m["name"] == name)


async def add_meal(client: AsyncClient, slot: str, name: str) -> dict:
    response = await client.post(
        f"/days/{TODAY}/plan/{slot}/meal", json={"meal_id": await saved_meal_id(client, name)}
    )
    assert response.status_code == 201
    return next(m for m in response.json()["meals"] if m["meal_time"] == slot)


class TestDailyPlan:
    async def test_a_day_starts_empty_even_with_saved_meals(self, with_meals: AsyncClient):
        """Nothing is dealt in ahead of time: the plate holds only what was logged."""
        plan = (await with_meals.get(f"/days/{TODAY}/plan")).json()
        assert plan["meals"] == []

    async def test_adding_a_saved_meal_puts_its_foods_on_the_plate(self, with_meals: AsyncClient):
        lunch = await add_meal(with_meals, "lunch", "雞胸胡麻花椰飯")

        assert lunch["meal_id"] == await saved_meal_id(with_meals, "雞胸胡麻花椰飯")
        assert {i["food"]["template_id"] for i in lunch["items"]} == {
            "brown-rice-cooked",
            "chicken-breast-cooked",
            "broccoli-cooked",
        }
        assert lunch["nutrients"]["kcal"] > 0

    async def test_a_meal_added_next_to_other_food_does_not_name_the_slot(
        self, with_meals: AsyncClient
    ):
        tofu = await seeded_food_id(with_meals, "firm-tofu")
        await with_meals.post(
            f"/days/{TODAY}/plan/lunch/items", json={"food_id": tofu, "grams": 100}
        )

        lunch = await add_meal(with_meals, "lunch", "雞胸胡麻花椰飯")

        # Both stay, and the plate is no longer just that meal.
        assert len(lunch["items"]) == 4
        assert lunch["meal_id"] is None

    async def test_adding_a_meal_that_is_not_yours_is_rejected(self, with_meals: AsyncClient):
        response = await with_meals.post(
            f"/days/{TODAY}/plan/lunch/meal", json={"meal_id": "nope"}
        )
        assert response.status_code == 404

    async def test_plan_items_are_a_snapshot_not_a_pointer(self, with_meals: AsyncClient):
        """Editing the meal afterwards must not rewrite what is on today's plate."""
        lunch = await add_meal(with_meals, "lunch", "雞胸胡麻花椰飯")
        before = lunch["nutrients"]["kcal"]
        oil = await seeded_food_id(with_meals, "olive-oil")

        await with_meals.patch(
            f"/meals/{lunch['meal_id']}",
            json={"items": [{"food_id": oil, "grams": 100}]},
        )

        after = (await with_meals.get(f"/days/{TODAY}/plan")).json()
        still = next(m for m in after["meals"] if m["meal_time"] == "lunch")
        assert still["nutrients"]["kcal"] == before

    async def test_swapping_one_food_converts_the_portion(self, with_meals: AsyncClient):
        lunch = await add_meal(with_meals, "lunch", "雞胸胡麻花椰飯")
        protein = next(i for i in lunch["items"] if i["category_id"] == "protein")
        tofu_id = await seeded_food_id(with_meals, "firm-tofu")

        swapped = await with_meals.patch(
            f"/days/{TODAY}/plan/lunch/items",
            json={"item_id": protein["id"], "to_food_id": tofu_id},
        )

        assert swapped.status_code == 200
        new_lunch = next(m for m in swapped.json()["meals"] if m["meal_time"] == "lunch")
        tofu = next(i for i in new_lunch["items"] if i["food"]["id"] == tofu_id)
        assert tofu["grams"] > protein["grams"], "tofu is far less protein-dense"

    async def test_swapping_an_unknown_item_is_rejected(self, with_meals: AsyncClient):
        await add_meal(with_meals, "lunch", "雞胸胡麻花椰飯")
        tofu_id = await seeded_food_id(with_meals, "firm-tofu")
        response = await with_meals.patch(
            f"/days/{TODAY}/plan/lunch/items",
            json={"item_id": "nope", "to_food_id": tofu_id},
        )
        assert response.status_code == 404


async def test_planned_meals_show_up_in_the_day_calorie_count(with_meals: AsyncClient):
    """The today screen's "eaten X / target" comes from the plate, via P1's day query."""
    await add_meal(with_meals, "breakfast", "燕麥豆漿早餐")
    await with_meals.patch(f"/days/{TODAY}/meals/breakfast")

    day = (await with_meals.get(f"/days/{TODAY}")).json()
    assert day["flow"]["eaten"]["kcal"] > 0
