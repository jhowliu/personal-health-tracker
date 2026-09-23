"""Totalling a meal, and scaling its staples to the current calorie target.

Meals store *baseline* grams. When the calorie target moves, only the staple portions
follow it — protein and vegetables stay put, because the point of the deficit is to eat
the same amount of protein on fewer calories.
"""

from dataclasses import replace

from app.domain.models import ZERO_NUTRIENTS, Meal, MealItem, Nutrients

STAPLE_CATEGORY = "staple"


def total(items: tuple[MealItem, ...]) -> Nutrients:
    """Calories and macros for a set of items, computed from the food library."""
    return sum((item.nutrients for item in items), ZERO_NUTRIENTS).rounded()


def apply_carb_scale(items: tuple[MealItem, ...], carb_scale: float) -> tuple[MealItem, ...]:
    """Scale staple portions by carb_scale, leaving every other category alone.

    carb_scale comes from `nutrition.compute_targets`: the current carb target divided
    by the baseline the meals were built against. It is 1.0 when the user turned the
    setting off, in which case this is a no-op.
    """
    if carb_scale == 1.0:
        return items

    return tuple(
        replace(item, grams=_scaled_grams(item, carb_scale))
        if item.category_id == STAPLE_CATEGORY
        else item
        for item in items
    )


def scaled(meal: Meal, carb_scale: float) -> Meal:
    return replace(meal, items=apply_carb_scale(meal.items, carb_scale))


def _scaled_grams(item: MealItem, carb_scale: float) -> float:
    grams = item.grams * carb_scale
    if item.food.grams_per_unit:
        units = max(round(grams / item.food.grams_per_unit), 1)
        return round(units * item.food.grams_per_unit, 2)
    return round(grams / 5) * 5 or 5
