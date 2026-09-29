"""Turning "a food and a portion, or a custom name and its nutrition" into a Plate item.

Shared by the plan (adding to a Meal slot) and Extras, so the rules and their messages
exist once.
"""

from app.application.ports import FoodStore, MealPhotoStore
from app.domain.errors import NotFound, ValidationFailed
from app.domain.ids import new_id
from app.domain.models import Nutrients, PlateItem


class PlateIntake:
    def __init__(self, foods: FoodStore, photos: MealPhotoStore) -> None:
        self._foods = foods
        self._photos = photos

    async def item(
        self,
        user_id: str,
        *,
        food_id: str | None,
        grams: float | None,
        custom_name: str | None,
        nutrients: Nutrients | None,
        photo_id: str | None,
    ) -> PlateItem:
        """A new, unfrozen Plate item: a pickable Food at `grams`, or a custom item."""
        if photo_id and await self._photos.load(user_id, photo_id) is None:
            raise NotFound("找不到這張照片")

        if food_id:
            if grams is None or grams <= 0:
                raise ValidationFailed("已知食物需要大於 0 的份量")
            food = await self._foods.load(user_id, food_id)
            if food is None:
                raise NotFound("找不到這個食物")
            return PlateItem(new_id(), food, None, grams, None, photo_id, 0)

        if custom_name and nutrients:
            return PlateItem(new_id(), None, custom_name, None, nutrients, photo_id, 0)

        raise ValidationFailed("請提供食物份量或自訂食物營養")
