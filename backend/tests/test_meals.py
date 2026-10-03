import pytest

from app.domain.meals import total
from tests.factories import BROCCOLI, BROWN_RICE, CHICKEN_BREAST, item


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
