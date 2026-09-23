"""The user's own meals: the templates today's plate is built from.

Meals hold *baseline* grams. Scaling to the current calorie target happens when a day is
planned, not here — see `DailyPlanService`.
"""

from dataclasses import replace

from app.application.ports import FoodStore, MealStore
from app.domain.errors import NotFound, ValidationFailed
from app.domain.ids import new_id
from app.domain.meals import total
from app.domain.models import Meal, MealItem, MealTag, MealTime, Nutrients


class MealService:
    def __init__(self, meals: MealStore, foods: FoodStore) -> None:
        self._meals = meals
        self._foods = foods

    async def list(
        self, user_id: str, meal_time: MealTime | None = None, query: str | None = None
    ) -> tuple[Meal, ...]:
        return await self._meals.list(user_id, meal_time, query)

    async def get(self, user_id: str, meal_id: str) -> Meal:
        found = await self._meals.load(user_id, meal_id)
        if found is None:
            raise NotFound("找不到這道餐點")
        return found

    async def create(
        self,
        user_id: str,
        *,
        name: str,
        tag: MealTag,
        meal_times: frozenset[MealTime],
        items: tuple[tuple[str, float], ...],
    ) -> Meal:
        meal = Meal(
            id=new_id(),
            name=name,
            tag=tag,
            meal_times=meal_times,
            items=await self._resolve(user_id, items),
        )
        await self._meals.save(user_id, meal)
        return meal

    async def update(
        self,
        user_id: str,
        meal_id: str,
        *,
        name: str | None = None,
        tag: MealTag | None = None,
        meal_times: frozenset[MealTime] | None = None,
        items: tuple[tuple[str, float], ...] | None = None,
    ) -> Meal:
        current = await self.get(user_id, meal_id)
        meal = replace(
            current,
            name=name if name is not None else current.name,
            tag=tag if tag is not None else current.tag,
            meal_times=meal_times if meal_times is not None else current.meal_times,
            items=await self._resolve(user_id, items) if items is not None else current.items,
        )
        await self._meals.save(user_id, meal)
        return meal

    async def remove(self, user_id: str, meal_id: str) -> None:
        await self.get(user_id, meal_id)
        await self._meals.archive(user_id, meal_id)

    async def calculate(self, user_id: str, items: tuple[tuple[str, float], ...]) -> Nutrients:
        """Totals for a set of foods without storing anything.

        The edit screen calls this on every portion change, so the number the user sees
        while typing comes from the same code that computes the saved meal.
        """
        return total(await self._resolve(user_id, items))

    async def _resolve(
        self, user_id: str, items: tuple[tuple[str, float], ...]
    ) -> tuple[MealItem, ...]:
        """Turn (food_id, grams) pairs into items, rejecting unknown foods up front."""
        resolved: list[MealItem] = []
        for order, (food_id, grams) in enumerate(items):
            if grams <= 0:
                raise ValidationFailed("份量要大於 0")
            food = await self._foods.load(user_id, food_id)
            if food is None:
                raise NotFound(f"找不到食物 {food_id}")
            resolved.append(
                MealItem(id=new_id(), food=food, grams=grams, sort_order=order)
            )
        return tuple(resolved)
