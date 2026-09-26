from httpx import AsyncClient

TODAY = "2026-09-22"


async def test_meal_round_trip(with_foods: AsyncClient):
    created = await with_foods.post(
        "/meals",
        json={
            "name": "雞胸胡麻花椰飯",
            "tag": "regular",
            "meal_times": ["lunch", "dinner"],
            "items": [
                {"food_id": "brown-rice-cooked", "grams": 120},
                {"food_id": "chicken-breast-cooked", "grams": 100},
                {"food_id": "broccoli-cooked", "grams": 150},
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

    updated = await with_meals.patch(
        f"/meals/{meal['id']}",
        json={"items": [{"food_id": "banana", "grams": 100}]},
    )

    assert updated.status_code == 200
    assert [i["food"]["id"] for i in updated.json()["items"]] == ["banana"]
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
        response = await with_foods.post(
            "/meals/calculate",
            json={
                "items": [
                    {"food_id": "brown-rice-cooked", "grams": 120},
                    {"food_id": "chicken-breast-cooked", "grams": 100},
                ]
            },
        )

        assert response.json()["kcal"] == 297.0
        assert (await with_foods.get("/meals")).json() == [], "nothing was stored"

    async def test_empty_draft_totals_zero(self, with_foods: AsyncClient):
        response = await with_foods.post("/meals/calculate", json={"items": []})
        assert response.json()["kcal"] == 0


class TestDailyPlan:
    async def test_first_look_deals_a_plan(self, with_meals: AsyncClient):
        plan = (await with_meals.get(f"/days/{TODAY}/plan")).json()

        slots = {m["meal_time"] for m in plan["meals"]}
        assert slots == {"breakfast", "lunch", "dinner"}
        assert plan["nutrients"]["kcal"] > 0

    async def test_the_plan_is_stable_across_reads(self, with_meals: AsyncClient):
        first = (await with_meals.get(f"/days/{TODAY}/plan")).json()
        second = (await with_meals.get(f"/days/{TODAY}/plan")).json()

        assert first == second

    async def test_lunch_and_dinner_differ(self, with_meals: AsyncClient):
        plan = (await with_meals.get(f"/days/{TODAY}/plan")).json()
        by_slot = {m["meal_time"]: m["meal_id"] for m in plan["meals"]}

        assert by_slot["lunch"] != by_slot["dinner"]

    async def test_plan_items_are_a_snapshot_not_a_pointer(self, with_meals: AsyncClient):
        """Editing the meal afterwards must not rewrite what was planned for today."""
        plan = (await with_meals.get(f"/days/{TODAY}/plan")).json()
        lunch = next(m for m in plan["meals"] if m["meal_time"] == "lunch")
        before = lunch["nutrients"]["kcal"]

        await with_meals.patch(
            f"/meals/{lunch['meal_id']}",
            json={"items": [{"food_id": "olive-oil", "grams": 100}]},
        )

        after = (await with_meals.get(f"/days/{TODAY}/plan")).json()
        still = next(m for m in after["meals"] if m["meal_time"] == "lunch")
        assert still["nutrients"]["kcal"] == before

    async def test_shuffling_one_slot_leaves_the_others(self, with_meals: AsyncClient):
        before = (await with_meals.get(f"/days/{TODAY}/plan")).json()
        by_slot = {m["meal_time"]: m["meal_id"] for m in before["meals"]}

        after = (
            await with_meals.post(f"/days/{TODAY}/plan/shuffle", json={"meal_time": "lunch"})
        ).json()
        after_by_slot = {m["meal_time"]: m["meal_id"] for m in after["meals"]}

        assert after_by_slot["lunch"] != by_slot["lunch"]
        assert after_by_slot["breakfast"] == by_slot["breakfast"]

    async def test_swapping_one_food_converts_the_portion(self, with_meals: AsyncClient):
        plan = (await with_meals.get(f"/days/{TODAY}/plan")).json()
        lunch = next(m for m in plan["meals"] if m["meal_time"] == "lunch")
        protein = next(i for i in lunch["items"] if i["category_id"] == "protein")

        swapped = await with_meals.patch(
            f"/days/{TODAY}/plan/lunch/items",
            json={"item_id": protein["id"], "to_food_id": "firm-tofu"},
        )

        assert swapped.status_code == 200
        new_lunch = next(m for m in swapped.json()["meals"] if m["meal_time"] == "lunch")
        tofu = next(i for i in new_lunch["items"] if i["food"]["id"] == "firm-tofu")
        assert tofu["grams"] > protein["grams"], "tofu is far less protein-dense"

    async def test_swapping_an_unknown_item_is_rejected(self, with_meals: AsyncClient):
        await with_meals.get(f"/days/{TODAY}/plan")
        response = await with_meals.patch(
            f"/days/{TODAY}/plan/lunch/items",
            json={"item_id": "nope", "to_food_id": "firm-tofu"},
        )
        assert response.status_code == 404

    async def test_eaten_meals_survive_a_shuffle(self, with_meals: AsyncClient):
        """What someone already ate is a fact, not something a reshuffle rewrites."""
        before = (await with_meals.get(f"/days/{TODAY}/plan")).json()
        eaten = next(m for m in before["meals"] if m["meal_time"] == "lunch")

        await with_meals.patch(f"/days/{TODAY}/meals/lunch")
        await with_meals.post(f"/days/{TODAY}/plan/shuffle", json={})

        after = (await with_meals.get(f"/days/{TODAY}/plan")).json()
        still = next(m for m in after["meals"] if m["meal_time"] == "lunch")
        assert still["meal_id"] == eaten["meal_id"]

    async def test_no_meals_means_no_plan_rather_than_an_error(self, with_foods: AsyncClient):
        plan = (await with_foods.get(f"/days/{TODAY}/plan")).json()
        assert plan["meals"] == []

    async def test_shuffling_without_meals_explains_itself(self, with_foods: AsyncClient):
        response = await with_foods.post(f"/days/{TODAY}/plan/shuffle", json={})
        assert response.status_code == 404


async def test_planned_meals_show_up_in_the_day_calorie_count(with_meals: AsyncClient):
    """The today screen's "eaten X / target" comes from the plan, via P1's day query."""
    await with_meals.get(f"/days/{TODAY}/plan")
    await with_meals.patch(f"/days/{TODAY}/meals/breakfast")

    day = (await with_meals.get(f"/days/{TODAY}")).json()
    assert day["flow"]["eaten"]["kcal"] > 0
