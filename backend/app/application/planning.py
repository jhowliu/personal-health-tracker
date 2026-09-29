"""Today's plate: which meal fills each slot, at what portions.

Two things separate this from `MealService`:

* portions here have carb_scale applied, so they follow the current calorie target
* what gets written is a *snapshot* — editing a meal tomorrow never rewrites today
"""

import hashlib
from dataclasses import replace
from datetime import date

from app.application.plate_intake import PlateIntake
from app.application.ports import (
    AccountStore,
    Clock,
    DayStore,
    FoodStore,
    MealStore,
)
from app.domain.errors import NotFound, ValidationFailed
from app.domain.exchange import convert, default_basis
from app.domain.ids import new_id
from app.domain.meals import apply_carb_scale
from app.domain.models import (
    PLANNED_SLOTS,
    DayPlan,
    Meal,
    MealItem,
    MealTime,
    Nutrients,
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
        intake: PlateIntake,
    ) -> None:
        self._days = days
        self._meals = meals
        self._foods = foods
        self._accounts = accounts
        self._clock = clock
        self._intake = intake

    async def view(self, user_id: str, day: date) -> DayPlan:
        """Today's plate, generating one on first look if the user has meals to draw on."""
        if not await self._days.load_plan(user_id, day):
            profile = await self._accounts.load_profile(user_id)
            if profile is not None and profile.auto_assign_meals:
                await self._generate(user_id, day, seed=_seed(user_id, day))
        return await self._plan(user_id, day)

    async def shuffle(self, user_id: str, day: date, meal_time: MealTime | None = None) -> DayPlan:
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
        return await self._plan(user_id, day)

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
        self._check_meal_time(meal_time)
        plan = DayPlan(date=day, meals=await self._days.load_plan(user_id, day))
        slot = plan.slot(meal_time)
        if slot is None:
            raise NotFound("今天這個時段還沒有餐點")

        item = next((i for i in slot.items if i.id == item_id), None)
        if item is None:
            raise NotFound("找不到要替換的項目")
        if item.food is None or item.grams is None:
            raise ValidationFailed("自訂項目不能交換食物")

        target = await self._foods.load(user_id, to_food_id)
        if target is None:
            raise NotFound("找不到要換成的食物")

        if basis is None:
            basis = default_basis(await self._foods.categories(), item.food.category_id)

        swap = convert(item.food, item.grams, target, basis)
        await self._days.replace_plan_item(user_id, day, meal_time, item_id, target.id, swap.grams)
        return await self._plan(user_id, day)

    async def add_item(
        self,
        user_id: str,
        day: date,
        meal_time: MealTime,
        *,
        food_id: str | None,
        grams: float | None,
        custom_name: str | None,
        nutrients: Nutrients | None,
        photo_id: str | None,
    ) -> DayPlan:
        self._check_meal_time(meal_time)
        item = await self._intake.item(
            user_id,
            food_id=food_id,
            grams=grams,
            custom_name=custom_name,
            nutrients=nutrients,
            photo_id=photo_id,
        )
        await self._days.add_plan_item(user_id, day, meal_time, item)
        return await self.view(user_id, day)

    async def update_item(
        self, user_id: str, day: date, meal_time: MealTime, item_id: str, grams: float
    ) -> DayPlan:
        self._check_meal_time(meal_time)
        plan = DayPlan(date=day, meals=await self._days.load_plan(user_id, day))
        slot = plan.slot(meal_time)
        item = next((item for item in slot.items if item.id == item_id), None) if slot else None
        if item is None:
            raise NotFound("找不到餐點項目")
        if item.food is None:
            raise ValidationFailed("自訂項目不能修改份量")
        if not await self._days.update_plan_item(user_id, day, meal_time, item_id, grams):
            raise NotFound("找不到餐點項目")
        return await self.view(user_id, day)

    async def delete_item(
        self, user_id: str, day: date, meal_time: MealTime, item_id: str
    ) -> None:
        self._check_meal_time(meal_time)
        if not await self._days.delete_plan_item(user_id, day, meal_time, item_id):
            raise NotFound("找不到餐點項目")

    async def _plan(self, user_id: str, day: date) -> DayPlan:
        return DayPlan(
            date=day,
            meals=await self._days.load_plan(user_id, day),
            extras=await self._days.load_extras(user_id, day),
        )

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
        await self._days.save_plan(user_id, day, snapshot)

    @staticmethod
    def _check_meal_time(meal_time: MealTime) -> None:
        if meal_time not in PLANNED_SLOTS:
            raise ValidationFailed("額外餐點不屬於計畫餐點")


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
