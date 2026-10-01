"""Today's plate: what was eaten at each slot, at what portions.

Nothing is dealt in ahead of time; foods arrive from a photo, one at a time, or as a whole
saved meal. Two things separate this from `MealService`:

* a saved meal's portions get carb_scale applied, so they follow the current calorie target
* what gets written is a *snapshot*: editing a meal tomorrow never rewrites today
"""

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
    MealTime,
    Nutrients,
    PlateItem,
    SwapBasis,
)
from app.domain.nutrition import compute_targets


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
        return await self._plan(user_id, day)

    async def add_meal(
        self, user_id: str, day: date, meal_time: MealTime, meal_id: str
    ) -> DayPlan:
        """Put one of the user's saved meals on the plate, portions scaled to today's target.

        On an empty slot the slot takes the meal's name; added next to other foods it does
        not, because the plate is then no longer that meal.
        """
        self._check_meal_time(meal_time)
        meal = await self._meals.load(user_id, meal_id)
        if meal is None:
            raise NotFound("找不到這道餐點")
        profile = await self._accounts.load_profile(user_id)
        if profile is None:
            raise NotFound("還沒有建立個人資料")

        slot = DayPlan(date=day, meals=await self._days.load_plan(user_id, day)).slot(meal_time)
        was_empty = slot is None or not slot.items
        scale = compute_targets(profile, day).carb_scale
        for item in apply_carb_scale(meal.items, scale):
            await self._days.add_plan_item(
                user_id,
                day,
                meal_time,
                PlateItem(new_id(), item.food, None, item.grams, None, None, 0),
            )
        if was_empty:
            await self._days.link_meal(user_id, day, meal_time, meal.id)
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

    @staticmethod
    def _check_meal_time(meal_time: MealTime) -> None:
        if meal_time not in PLANNED_SLOTS:
            raise ValidationFailed("額外餐點不屬於計畫餐點")
