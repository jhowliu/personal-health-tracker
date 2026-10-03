"""Totalling a meal or a day."""

from collections.abc import Iterable
from typing import Protocol

from app.domain.models import ZERO_NUTRIENTS, DayPlan, Nutrients


class _HasNutrients(Protocol):
    @property
    def nutrients(self) -> Nutrients: ...


def total(items: Iterable[_HasNutrients]) -> Nutrients:
    """Calories and macros for a set of items, computed from the food library."""
    return sum((item.nutrients for item in items), ZERO_NUTRIENTS).rounded()


def planned_total(plan: DayPlan) -> Nutrients:
    """What the day adds up to if everything not skipped gets eaten, plus Extras."""
    meals = (item for meal in plan.meals if not meal.skipped for item in meal.items)
    return total((*meals, *plan.extras))
