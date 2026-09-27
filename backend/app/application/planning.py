"""Today's plate: which meal fills each slot, at what portions.

Two things separate this from `MealService`:

* portions here have carb_scale applied, so they follow the current calorie target
* what gets written is a *snapshot* — editing a meal tomorrow never rewrites today
"""

import hashlib
from dataclasses import replace
from datetime import date

from app.application.ports import (
    AccountStore,
    Clock,
    DayStore,
    FoodStore,
    MealPhotoStore,
    MealStore,
)
from app.domain.errors import NotFound, ValidationFailed
from app.domain.exchange import convert
from app.domain.ids import new_id
from app.domain.meals import apply_carb_scale
from app.domain.models import (
    DayPlan,
    Meal,
    MealItem,
    MealTime,
    Nutrients,
    PlannedItem,
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
        photos: MealPhotoStore,
    ) -> None:
        self._days = days
        self._meals = meals
        self._foods = foods
        self._accounts = accounts
        self._clock = clock
        self._photos = photos

    async def view(self, user_id: str, day: date) -> DayPlan:
        """Today's plate, generating one on first look if the user has meals to draw on."""
        stored = await self._days.load_plan(user_id, day)
        if stored:
            return DayPlan(
                date=day, meals=stored, extras=await self._days.load_extras(user_id, day)
            )

        profile = await self._accounts.load_profile(user_id)
        if profile is None or not profile.auto_assign_meals:
            return DayPlan(
                date=day, meals=stored, extras=await self._days.load_extras(user_id, day)
            )

        await self._generate(user_id, day, seed=_seed(user_id, day))
        return DayPlan(
            date=day,
            meals=await self._days.load_plan(user_id, day),
            extras=await self._days.load_extras(user_id, day),
        )

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
        return DayPlan(
            date=day,
            meals=await self._days.load_plan(user_id, day),
            extras=await self._days.load_extras(user_id, day),
        )

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
        await self._ensure_day(user_id, day)
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
            categories = {c.id: c for c in await self._foods.categories()}
            category = categories.get(item.food.category_id)
            basis = category.swap_by if category else SwapBasis.KCAL

        swap = convert(item.food, item.grams, target, basis)
        await self._days.replace_plan_item(user_id, day, meal_time, item_id, target.id, swap.grams)
        return DayPlan(
            date=day,
            meals=await self._days.load_plan(user_id, day),
            extras=await self._days.load_extras(user_id, day),
        )

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
        profile = await self._ensure_day(user_id, day)
        if photo_id and await self._photos.load(user_id, photo_id) is None:
            raise NotFound("找不到這張照片")
        if food_id:
            if grams is None or grams <= 0:
                raise ValidationFailed("已知食物需要大於 0 的份量")
            food = await self._foods.load(user_id, food_id)
            if food is None:
                raise NotFound("找不到這個食物")
            item = PlannedItem(new_id(), food, None, grams, None, photo_id, 0)
        elif custom_name and nutrients:
            item = PlannedItem(new_id(), None, custom_name, None, nutrients, photo_id, 0)
        else:
            raise ValidationFailed("請提供食物份量或自訂食物營養")
        await self._days.add_plan_item(user_id, day, meal_time, item, profile)
        return await self.view(user_id, day)

    async def update_item(
        self, user_id: str, day: date, meal_time: MealTime, item_id: str, grams: float
    ) -> DayPlan:
        self._check_meal_time(meal_time)
        await self._ensure_day(user_id, day)
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
        await self._ensure_day(user_id, day)
        if not await self._days.delete_plan_item(user_id, day, meal_time, item_id):
            raise NotFound("找不到餐點項目")

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

    async def _ensure_day(self, user_id: str, day: date):
        profile = await self._accounts.load_profile(user_id)
        if profile is None:
            raise NotFound("還沒有建立個人資料")
        await self._days.load_facts(user_id, day, profile)
        return profile

    @staticmethod
    def _check_meal_time(meal_time: MealTime) -> None:
        if meal_time is MealTime.EXTRAS:
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
