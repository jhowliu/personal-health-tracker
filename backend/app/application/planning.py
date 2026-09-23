"""Today's plate: which meal fills each slot, at what portions.

Two things separate this from `MealService`:

* portions here have carb_scale applied, so they follow the current calorie target
* what gets written is a *snapshot* — editing a meal tomorrow never rewrites today
"""

import hashlib
from dataclasses import replace
from datetime import date

from app.application.ports import AccountStore, Clock, DayStore, FoodStore, MealStore
from app.domain.errors import NotFound
from app.domain.exchange import convert
from app.domain.ids import new_id
from app.domain.meals import apply_carb_scale
from app.domain.models import (
    DayPlan,
    Meal,
    MealItem,
    MealTime,
    SwapBasis,
)
from app.domain.nutrition import compute_targets
from app.domain.planning import assign, reshuffle


class DailyPlanService:
    def __init__(
        self,
        days: DayStore,
        meals: MealStore,
        foods: FoodStore,
        accounts: AccountStore,
        clock: Clock,
    ) -> None:
        self._days = days
        self._meals = meals
        self._foods = foods
        self._accounts = accounts
        self._clock = clock

    async def view(self, user_id: str, day: date) -> DayPlan:
        """Today's plate, generating one on first look if the user has meals to draw on."""
        stored = await self._days.load_plan(user_id, day)
        if stored:
            return DayPlan(date=day, meals=stored)

        profile = await self._accounts.load_profile(user_id)
        if profile is None or not profile.auto_assign_meals:
            return DayPlan(date=day, meals=stored)

        await self._generate(user_id, day, seed=_seed(user_id, day))
        return DayPlan(date=day, meals=await self._days.load_plan(user_id, day))

    async def shuffle(
        self, user_id: str, day: date, meal_time: MealTime | None = None
    ) -> DayPlan:
        """Deal a different meal — one slot, or the whole day."""
        library = await self._meals.list(user_id, None, None)
        if not library:
            raise NotFound("還沒有可以分配的餐點")

        by_id = {meal.id: meal for meal in library}
        current = {
            planned.meal_time: by_id[planned.meal_id]
            for planned in await self._days.load_plan(user_id, day)
            if planned.meal_id in by_id
        }

        # A fresh nonce each call, otherwise shuffling twice would deal the same hand.
        nonce = int(self._clock.now().timestamp() * 1000)
        chosen = reshuffle(library, current, seed=_seed(user_id, day) ^ nonce, only=meal_time)

        await self._write(user_id, day, chosen)
        return DayPlan(date=day, meals=await self._days.load_plan(user_id, day))

    async def swap_item(
        self,
        user_id: str,
        day: date,
        meal_time: MealTime,
        item_id: str,
        to_food_id: str,
        basis: SwapBasis | None = None,
    ) -> DayPlan:
        """Replace one food on today's plate, converting the portion as we go."""
        plan = DayPlan(date=day, meals=await self._days.load_plan(user_id, day))
        slot = plan.slot(meal_time)
        if slot is None:
            raise NotFound("今天這個時段還沒有餐點")

        item = next((i for i in slot.items if i.id == item_id), None)
        if item is None:
            raise NotFound("找不到要替換的項目")

        target = await self._foods.load(user_id, to_food_id)
        if target is None:
            raise NotFound("找不到要換成的食物")

        if basis is None:
            categories = {c.id: c for c in await self._foods.categories()}
            category = categories.get(item.food.category_id)
            basis = category.swap_by if category else SwapBasis.KCAL

        swap = convert(item.food, item.grams, target, basis)
        await self._days.replace_plan_item(
            user_id, day, meal_time, item_id, target.id, swap.grams
        )
        return DayPlan(date=day, meals=await self._days.load_plan(user_id, day))

    async def _generate(self, user_id: str, day: date, seed: int) -> None:
        library = await self._meals.list(user_id, None, None)
        if library:
            await self._write(user_id, day, assign(library, seed=seed))

    async def _write(self, user_id: str, day: date, chosen: dict[MealTime, Meal]) -> None:
        """Scale to today's target, then hand the snapshot to the store."""
        profile = await self._accounts.load_profile(user_id)
        if profile is None:
            raise NotFound("還沒有建立個人資料")

        scale = compute_targets(profile, day).carb_scale
        snapshot = {
            slot: (meal.id, meal.name, _fresh_ids(apply_carb_scale(meal.items, scale)))
            for slot, meal in chosen.items()
        }
        await self._days.save_plan(user_id, day, snapshot, profile)


def _fresh_ids(items: tuple[MealItem, ...]) -> tuple[MealItem, ...]:
    """Snapshot rows get their own ids — they outlive the meal items they came from."""
    return tuple(replace(item, id=new_id()) for item in items)


def _seed(user_id: str, day: date) -> int:
    """Stable per user per day, so looking at today twice shows the same plan.

    Not builtin hash(): string hashing is salted per process, so a server restart would
    silently deal a different plan for the same day.
    """
    digest = hashlib.sha256(f"{user_id}:{day.isoformat()}".encode()).digest()
    return int.from_bytes(digest[:4], "big")
