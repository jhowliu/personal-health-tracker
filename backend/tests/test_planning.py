from app.domain.models import MealTag, MealTime
from app.domain.planning import assign, reshuffle
from tests.factories import BROWN_RICE, CHICKEN_BREAST, item, meal

BREAKFAST = (MealTime.BREAKFAST,)
LUNCH_DINNER = (MealTime.LUNCH, MealTime.DINNER)


def regular(id: str, times=LUNCH_DINNER):
    return meal(id, item(BROWN_RICE, 120), item(CHICKEN_BREAST, 100), times=times)


def test_fills_every_slot_the_user_has_meals_for():
    meals = (regular("oats", BREAKFAST), regular("a"), regular("b"))

    plan = assign(meals, seed=1)

    assert set(plan) == {MealTime.BREAKFAST, MealTime.LUNCH, MealTime.DINNER}


def test_lunch_and_dinner_are_never_the_same_meal():
    meals = (regular("a"), regular("b"), regular("c"))

    for seed in range(20):
        plan = assign(meals, seed=seed)
        assert plan[MealTime.LUNCH].id != plan[MealTime.DINNER].id


def test_repeats_rather_than_leaving_a_slot_empty():
    """One lunch-and-dinner meal is better served twice than not at all."""
    plan = assign((regular("only"),), seed=1)

    assert plan[MealTime.LUNCH].id == "only"
    assert plan[MealTime.DINNER].id == "only"


def test_same_seed_gives_the_same_plan():
    meals = (regular("a"), regular("b"), regular("c"))

    assert assign(meals, seed=7) == assign(meals, seed=7)


def test_different_seeds_eventually_differ():
    meals = (regular("a"), regular("b"), regular("c"), regular("d"))

    plans = {assign(meals, seed=s)[MealTime.LUNCH].id for s in range(20)}
    assert len(plans) > 1


def test_only_regular_meals_are_auto_assigned():
    meals = (
        meal("treat", item(BROWN_RICE, 120), tag=MealTag.OCCASIONAL),
        meal("light", item(BROWN_RICE, 80), tag=MealTag.LIGHT),
        regular("daily"),
    )

    plan = assign(meals, seed=3)

    assert {m.id for m in plan.values()} == {"daily"}


def test_slot_with_no_matching_meal_is_left_out():
    plan = assign((regular("lunch-only", (MealTime.LUNCH,)),), seed=1)

    assert MealTime.BREAKFAST not in plan
    assert MealTime.DINNER not in plan
    assert plan[MealTime.LUNCH].id == "lunch-only"


def test_no_meals_at_all_gives_an_empty_plan():
    assert assign((), seed=1) == {}


class TestReshuffle:
    def test_swaps_one_slot_and_leaves_the_rest(self):
        meals = (regular("a"), regular("b"), regular("c"))
        current = assign(meals, seed=1)

        after = reshuffle(meals, current, seed=2, only=MealTime.LUNCH)

        assert after[MealTime.LUNCH].id != current[MealTime.LUNCH].id
        assert after[MealTime.DINNER].id == current[MealTime.DINNER].id

    def test_keeps_the_meal_when_there_is_nothing_else(self):
        meals = (regular("only"),)
        current = assign(meals, seed=1)

        after = reshuffle(meals, current, seed=9, only=MealTime.LUNCH)

        assert after[MealTime.LUNCH].id == "only"

    def test_reshuffling_everything_touches_every_slot(self):
        meals = (regular("a"), regular("b"), regular("oats", BREAKFAST), regular("eggs", BREAKFAST))
        current = assign(meals, seed=1)

        after = reshuffle(meals, current, seed=5)

        for slot in current:
            assert after[slot].id != current[slot].id
