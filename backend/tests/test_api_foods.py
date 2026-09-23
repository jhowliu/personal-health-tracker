from httpx import AsyncClient

CHICKEN_BREAST = "chicken-breast-cooked"


async def test_categories_carry_their_swap_rule(with_foods: AsyncClient):
    categories = {c["id"]: c for c in (await with_foods.get("/food-categories")).json()}

    assert categories["staple"]["swap_by"] == "carb"
    assert categories["protein"]["swap_by"] == "protein"
    assert categories["staple"]["name"] == "主食"


async def test_browsing_by_category(with_foods: AsyncClient):
    foods = (await with_foods.get("/foods?category=protein")).json()

    assert len(foods) >= 8
    assert {f["category_id"] for f in foods} == {"protein"}


async def test_search_matches_the_name(with_foods: AsyncClient):
    foods = (await with_foods.get("/foods?q=雞胸")).json()
    assert CHICKEN_BREAST in [f["id"] for f in foods]


async def test_search_matches_an_alias(with_foods: AsyncClient):
    """"雞腿" is an alias; the stored name is 去骨雞腿(帶皮、熟)."""
    foods = (await with_foods.get("/foods?q=雞腿")).json()

    assert "chicken-thigh-skin-on-cooked" in [f["id"] for f in foods]


async def test_search_matches_an_english_alias(with_foods: AsyncClient):
    foods = (await with_foods.get("/foods?q=tofu")).json()
    assert "firm-tofu" in [f["id"] for f in foods]


async def test_foods_report_state_and_usual_portion(with_foods: AsyncClient):
    rice = next(
        f for f in (await with_foods.get("/foods?q=糙米")).json() if f["id"] == "brown-rice-cooked"
    )

    assert rice["state"] == "cooked", "raw and cooked rice differ ~3x per 100 g"
    assert rice["usual_grams"] == 120


async def test_foods_counted_in_pieces_expose_grams_per_unit(with_foods: AsyncClient):
    proteins = (await with_foods.get("/foods?category=protein")).json()
    egg = next(f for f in proteins if f["id"] == "egg")
    assert egg["grams_per_unit"] == 50
    assert egg["unit"] == "piece"


class TestCustomFoods:
    async def test_round_trip(self, with_foods: AsyncClient):
        created = await with_foods.post(
            "/foods",
            json={
                "category_id": "protein",
                "name": "我家的滷雞腿",
                "state": "cooked",
                "kcal_per_100g": 200,
                "protein_per_100g": 25,
                "fat_per_100g": 11,
                "carb_per_100g": 1,
                "usual_grams": 120,
                "max_grams": 200,
            },
        )
        assert created.status_code == 201
        food = created.json()
        assert not food["is_builtin"]

        found = (await with_foods.get("/foods?q=滷雞腿")).json()
        assert [f["id"] for f in found] == [food["id"]]

        assert (await with_foods.delete(f"/foods/{food['id']}")).status_code == 204
        assert (await with_foods.get("/foods?q=滷雞腿")).json() == []

    async def test_builtin_foods_cannot_be_deleted(self, with_foods: AsyncClient):
        response = await with_foods.delete(f"/foods/{CHICKEN_BREAST}")
        assert response.status_code == 403


class TestExchanges:
    async def test_matches_the_spec_worked_example(self, with_foods: AsyncClient):
        """100 g chicken breast swaps to 130 g of thigh on equal protein."""
        swaps = (
            await with_foods.get(f"/foods/{CHICKEN_BREAST}/exchanges?grams=100")
        ).json()

        thigh = next(s for s in swaps if s["food"]["id"] == "chicken-thigh-skin-on-cooked")
        assert thigh["grams"] == 130
        assert not thigh["capped"]

    async def test_excludes_the_source_food(self, with_foods: AsyncClient):
        swaps = (await with_foods.get(f"/foods/{CHICKEN_BREAST}/exchanges")).json()
        assert CHICKEN_BREAST not in [s["food"]["id"] for s in swaps]

    async def test_only_offers_the_same_category(self, with_foods: AsyncClient):
        swaps = (await with_foods.get(f"/foods/{CHICKEN_BREAST}/exchanges")).json()
        assert {s["food"]["category_id"] for s in swaps} == {"protein"}

    async def test_reports_when_the_portion_cap_bites(self, with_foods: AsyncClient):
        swaps = (
            await with_foods.get(f"/foods/{CHICKEN_BREAST}/exchanges?grams=150")
        ).json()

        tofu = next(s for s in swaps if s["food"]["id"] == "firm-tofu")
        assert tofu["capped"], "matching 46 g of protein with tofu blows past its cap"
        assert tofu["delta"]["protein_g"] < 0

    async def test_matching_on_calories_instead(self, with_foods: AsyncClient):
        swaps = (
            await with_foods.get(
                f"/foods/{CHICKEN_BREAST}/exchanges?grams=100&match=kcal"
            )
        ).json()

        thigh = next(s for s in swaps if s["food"]["id"] == "chicken-thigh-skin-on-cooked")
        assert abs(thigh["delta"]["kcal"]) < 15
        assert thigh["delta"]["protein_g"] < 0

    async def test_defaults_to_the_usual_portion(self, with_foods: AsyncClient):
        without = (await with_foods.get(f"/foods/{CHICKEN_BREAST}/exchanges")).json()
        with_grams = (
            await with_foods.get(f"/foods/{CHICKEN_BREAST}/exchanges?grams=100")
        ).json()

        assert without == with_grams, "usual_grams for chicken breast is 100"
