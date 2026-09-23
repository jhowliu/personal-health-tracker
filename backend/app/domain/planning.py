"""Picking which of the user's own meals to eat at each slot today.

Deliberately dull: pick a whole meal that suits the slot, and do not serve the same one
at lunch and dinner. P3 replaces the picking strategy with Jev (which looks at what was
eaten the last few days and whether today is a training day) behind this same interface.

Takes a seed rather than reaching for the global RNG, so a given day always produces the
same plan and tests can assert on it.
"""

import random

from app.domain.models import Meal, MealTag, MealTime

PLANNED_SLOTS = (MealTime.BREAKFAST, MealTime.LUNCH, MealTime.DINNER)


def assign(
    meals: tuple[Meal, ...], seed: int, avoid_repeat_between: tuple[MealTime, ...] = ()
) -> dict[MealTime, Meal]:
    """Choose one meal per slot from the user's regular meals.

    Only `regular` meals are auto-assigned — `light` and `occasional` ones are there for
    the user to reach for deliberately, not to be handed out by the shuffler.

    `avoid_repeat_between` defaults to lunch and dinner: eating the same thing twice in
    one day is the complaint this rule exists to prevent. A slot is simply left out when
    the user has no meal tagged for it.
    """
    avoid = avoid_repeat_between or (MealTime.LUNCH, MealTime.DINNER)
    rng = random.Random(seed)

    regular = [meal for meal in meals if meal.tag is MealTag.REGULAR]
    plan: dict[MealTime, Meal] = {}
    used_in_avoid_group: set[str] = set()

    for slot in PLANNED_SLOTS:
        candidates = [meal for meal in regular if slot in meal.meal_times]
        if slot in avoid:
            fresh = [meal for meal in candidates if meal.id not in used_in_avoid_group]
            # Fall back to repeating rather than leaving the slot empty when the user
            # only has one meal for it.
            candidates = fresh or candidates
        if not candidates:
            continue

        chosen = rng.choice(sorted(candidates, key=lambda meal: meal.id))
        plan[slot] = chosen
        if slot in avoid:
            used_in_avoid_group.add(chosen.id)

    return plan


def reshuffle(
    meals: tuple[Meal, ...],
    current: dict[MealTime, Meal],
    seed: int,
    only: MealTime | None = None,
) -> dict[MealTime, Meal]:
    """Swap out the whole plan, or just one slot when `only` is given.

    Tries to hand back something different from what is already there; if the user has
    nothing else that fits the slot, it keeps what they had.
    """
    rng = random.Random(seed)
    slots = (only,) if only else PLANNED_SLOTS
    regular = [meal for meal in meals if meal.tag is MealTag.REGULAR]

    plan = dict(current)
    for slot in slots:
        candidates = [meal for meal in regular if slot in meal.meal_times]
        existing = current.get(slot)
        different = [meal for meal in candidates if existing is None or meal.id != existing.id]
        pool = different or candidates
        if pool:
            plan[slot] = rng.choice(sorted(pool, key=lambda meal: meal.id))

    return plan
