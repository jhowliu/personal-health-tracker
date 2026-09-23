import pytest

from app.domain.meals import apply_carb_scale, scaled, total
from tests.factories import BROCCOLI, BROWN_RICE, CHICKEN_BREAST, EGG, item, meal


def test_totals_come_from_the_food_library():
    items = (item(BROWN_RICE, 120), item(CHICKEN_BREAST, 100), item(BROCCOLI, 150))

    result = total(items)

    # kcal:    rice 132  + breast 165 + broccoli 37.5
    # protein: rice 2.4  + breast 31  + broccoli 4.5
    # carb:    rice 27.6 + breast 0   + broccoli 7.5
    assert result.kcal == pytest.approx(334.5)
    assert result.protein_g == pytest.approx(37.9)
    assert result.carb_g == pytest.approx(35.1)


def test_empty_meal_totals_zero():
    assert total(()).kcal == 0


class TestCarbScale:
    def test_scales_staples_only(self):
        items = (item(BROWN_RICE, 120), item(CHICKEN_BREAST, 100), item(BROCCOLI, 150))

        result = apply_carb_scale(items, 0.9)
        by_id = {i.food.id: i.grams for i in result}

        assert by_id["brown-rice"] == 110, "120 x 0.9 = 108 -> nearest 5"
        assert by_id["chicken-breast"] == 100, "protein must not move"
        assert by_id["broccoli"] == 150, "vegetables must not move"

    def test_scale_of_one_changes_nothing(self):
        items = (item(BROWN_RICE, 120), item(CHICKEN_BREAST, 100))
        assert apply_carb_scale(items, 1.0) == items

    def test_scaling_up_works_too(self):
        result = apply_carb_scale((item(BROWN_RICE, 120),), 1.25)
        assert result[0].grams == 150

    def test_staples_counted_in_units_stay_whole(self):
        bread = EGG  # counted in pieces at 50 g each
        staple_bread = item(
            bread, 100
        )  # two pieces
        result = apply_carb_scale((staple_bread,), 0.9)
        # 100 x 0.9 = 90 -> 1.8 pieces -> 2 pieces -> 100 g, but bread is protein here
        assert result[0].grams == 100, "non-staple categories are left alone"

    def test_never_scales_a_staple_to_zero(self):
        result = apply_carb_scale((item(BROWN_RICE, 5),), 0.1)
        assert result[0].grams == 5

    def test_scaled_meal_keeps_everything_else(self):
        original = meal("m1", item(BROWN_RICE, 120), item(CHICKEN_BREAST, 100))

        result = scaled(original, 0.9)

        assert result.id == original.id
        assert result.name == original.name
        assert result.meal_times == original.meal_times
        assert result.items[0].grams == 110

    def test_baseline_is_untouched_by_scaling(self):
        """Meals store baseline grams; scaling returns new objects, never mutates."""
        items = (item(BROWN_RICE, 120),)
        apply_carb_scale(items, 0.5)
        assert items[0].grams == 120
