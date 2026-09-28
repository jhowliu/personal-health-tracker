from dataclasses import replace
from datetime import datetime

import pytest

from app.domain.meals import planned_total, total
from app.domain.models import DayPlan, MealTime, Nutrients, PlannedMeal, PlateItem
from tests.factories import BROWN_RICE, CHICKEN_BREAST, food

EATEN_AT = datetime(2026, 9, 22, 12, 0)


def food_item(f, grams: float, id: str | None = None) -> PlateItem:
    return PlateItem(id or f.id, f, None, grams, None, None, 0)


def custom_item(kcal: float) -> PlateItem:
    return PlateItem("custom", None, "Latte", None, Nutrients(kcal, 1, 2, 3), None, 0)


def slot(*items: PlateItem, eaten: bool = False, skipped: bool = False) -> PlannedMeal:
    return PlannedMeal(
        MealTime.LUNCH,
        None,
        "",
        EATEN_AT if eaten else None,
        EATEN_AT if skipped else None,
        items,
    )


def test_a_live_item_follows_its_food():
    rice = food_item(BROWN_RICE, 100)

    assert rice.nutrients.kcal == pytest.approx(110)
    assert replace(rice, food=food("rice", kcal=200)).nutrients.kcal == pytest.approx(200)


def test_a_frozen_item_ignores_later_edits_to_its_food():
    frozen = food_item(BROWN_RICE, 100).freeze()

    edited = replace(frozen, food=food(BROWN_RICE.id, "staple", kcal=999))

    assert edited.nutrients.kcal == pytest.approx(110)


def test_changing_the_portion_rescales_the_frozen_nutrition():
    frozen = food_item(BROWN_RICE, 100).freeze()

    assert replace(frozen, grams=150).nutrients.kcal == pytest.approx(165)


def test_unfreezing_goes_back_to_following_the_food():
    unfrozen = food_item(BROWN_RICE, 100).freeze().unfreeze()

    assert unfrozen.frozen is None
    assert replace(unfrozen, food=food("rice", kcal=200)).nutrients.kcal == pytest.approx(200)


def test_freezing_again_records_the_foods_current_nutrition():
    frozen = food_item(BROWN_RICE, 100).freeze()
    edited = replace(frozen, food=food(BROWN_RICE.id, "staple", kcal=200))

    assert edited.freeze().nutrients.kcal == pytest.approx(200)


def test_custom_items_never_freeze():
    latte = custom_item(120)

    assert latte.freeze() is latte
    assert latte.nutrients.kcal == 120


def test_planned_total_counts_meals_not_skipped_plus_extras():
    plan = DayPlan(
        date=EATEN_AT.date(),
        meals=(
            slot(food_item(BROWN_RICE, 100)),
            slot(food_item(CHICKEN_BREAST, 100), eaten=True),
            slot(food_item(BROWN_RICE, 200, "skipped"), skipped=True),
        ),
        extras=(custom_item(120),),
    )

    assert planned_total(plan).kcal == pytest.approx(110 + 165 + 120)


def test_total_adds_up_plate_items():
    assert total((food_item(BROWN_RICE, 100), custom_item(90))).kcal == pytest.approx(200)
