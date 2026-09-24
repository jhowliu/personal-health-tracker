"""Meal-photo upload, recognition, and confirmation of extra food items."""

import json
from datetime import date

from app.application.decisions import DecisionService
from app.application.ports import (
    AccountStore,
    Clock,
    DayStore,
    FoodStore,
    ImageRecognizer,
    MealPhotoStore,
    ObjectStorage,
)
from app.domain.errors import NotFound, QuotaExceeded, ServiceUnavailable, ValidationFailed
from app.domain.ids import new_id
from app.domain.meal_photos import (
    ExtraItem,
    MealPhoto,
    MealPhotoStatus,
    Recognition,
    RecognizedFood,
    RecognizedItem,
)
from app.domain.models import Food, Nutrients

_IMAGE_TYPES = {"image/jpeg", "image/png"}
_CANDIDATE_LIMIT = 10
_ALTERNATIVE_LIMIT = 3


class MealPhotoService:
    def __init__(
        self,
        photos: MealPhotoStore,
        objects: ObjectStorage,
        recognizer: ImageRecognizer,
        foods: FoodStore,
        decisions: DecisionService,
        clock: Clock,
        daily_quota: int,
    ) -> None:
        self._photos = photos
        self._objects = objects
        self._recognizer = recognizer
        self._foods = foods
        self._decisions = decisions
        self._clock = clock
        self._daily_quota = daily_quota

    async def create(self, user_id: str, content_type: str) -> tuple[MealPhoto, str]:
        if content_type.lower() not in _IMAGE_TYPES:
            raise ValidationFailed("照片只接受 JPEG 或 PNG")
        photo_id = new_id()
        object_key, upload_url = await self._objects.create_upload_url(
            user_id, photo_id, content_type.lower()
        )
        photo = MealPhoto(
            id=photo_id,
            user_id=user_id,
            object_key=object_key,
            status=MealPhotoStatus.UPLOADED,
            result_json=None,
            created_at=self._clock.now(),
            analyzed_at=None,
        )
        await self._photos.create(photo)
        return photo, upload_url

    async def analyze(
        self, user_id: str, photo_id: str
    ) -> tuple[MealPhoto, tuple[RecognizedItem, ...]]:
        today = self._clock.now().date()
        if await self._photos.analyses_on(user_id, today) >= self._daily_quota:
            raise QuotaExceeded("今天的照片辨識額度已用完")

        photo = await self._photos.begin_analysis(user_id, photo_id, self._clock.now())
        if photo is None:
            raise NotFound("找不到這張照片")
        if photo.status is not MealPhotoStatus.ANALYZING:
            raise ValidationFailed("這張照片目前不能辨識")

        try:
            recognized = await self._recognizer.recognize(
                await self._objects.create_download_url(photo.object_key)
            )
            items = await self._match_foods(user_id, recognized)
            raw = json.dumps(
                {
                    "items": [
                        {
                            "label": item.label,
                            "grams": item.grams,
                            "confidence": item.confidence,
                            "label_confidence": source.confidence,
                            "food_id": item.food_id,
                            "alternatives": [
                                alternative.food_id for alternative in item.alternatives
                            ],
                        }
                        for item, source in zip(items, recognized, strict=True)
                    ]
                },
                ensure_ascii=False,
            )
            await self._photos.finish_analysis(user_id, photo_id, MealPhotoStatus.DONE.value, raw)
            done = await self._photos.load(user_id, photo_id)
            assert done is not None
            return done, items
        except Exception as exc:
            await self._photos.finish_analysis(
                user_id,
                photo_id,
                MealPhotoStatus.FAILED.value,
                json.dumps({"error": str(exc)}, ensure_ascii=False),
            )
            raise

    async def _match_foods(
        self, user_id: str, recognized: tuple[Recognition, ...]
    ) -> tuple[RecognizedItem, ...]:
        items: list[RecognizedItem] = []
        for item in recognized:
            candidates = await self._candidates(user_id, item.label)
            selected, confidence = await self._pick(item.label, candidates)
            # The screen looks the selected food up inside `alternatives`, so the chosen one
            # leads the list rather than being filtered out of it.
            ordered = (
                [selected] + [food for food in candidates if food.id != selected.id]
                if selected is not None
                else []
            )
            items.append(
                RecognizedItem(
                    label=item.label,
                    food_id=selected.id if selected else None,
                    category_id=selected.category_id if selected else None,
                    grams=item.grams,
                    confidence=confidence,
                    alternatives=tuple(
                        RecognizedFood(food.id, food.category_id, food.name)
                        for food in ordered[:_ALTERNATIVE_LIMIT]
                    ),
                )
            )
        return tuple(items)

    async def _candidates(self, user_id: str, label: str) -> tuple[Food, ...]:
        """Shortlist the library foods a label could mean, matching names and aliases."""
        candidates: list[Food] = []
        for match in await self._foods.search(user_id, label, None):
            # Search results are external input too: check visibility before exposing ids.
            valid = await self._foods.load(user_id, match.id)
            if valid is not None:
                candidates.append(valid)
            if len(candidates) == _CANDIDATE_LIMIT:
                break
        return tuple(candidates)

    async def _pick(self, label: str, candidates: tuple[Food, ...]) -> tuple[Food | None, float]:
        """Ask the decision layer which candidate the label means.

        Falls back to the best search hit at zero confidence whenever the layer is
        unavailable or unsure. That is what the spec asks for: still pre-fill something, but
        mark it as needing confirmation rather than pretending to be sure.
        """
        if not candidates:
            return None, 0.0
        try:
            result = await self._decisions.food_match(label, candidates)
        except ServiceUnavailable:
            return candidates[0], 0.0
        selected = next((food for food in candidates if food.id == result.selection_id), None)
        if selected is None:
            return candidates[0], 0.0
        return selected, result.confidence


class ExtrasService:
    def __init__(
        self, days: DayStore, foods: FoodStore, photos: MealPhotoStore, accounts: AccountStore
    ) -> None:
        self._days = days
        self._foods = foods
        self._photos = photos
        self._accounts = accounts

    async def add(
        self,
        user_id: str,
        day: date,
        *,
        food_id: str | None,
        grams: float | None,
        custom_name: str | None,
        nutrients: Nutrients | None,
        photo_id: str | None,
    ) -> ExtraItem:
        if photo_id and await self._photos.load(user_id, photo_id) is None:
            raise NotFound("找不到這張照片")
        if food_id:
            if grams is None or grams <= 0:
                raise ValidationFailed("已知食物需要大於 0 的份量")
            food = await self._foods.load(user_id, food_id)
            if food is None:
                raise NotFound("找不到這個食物")
            item = ExtraItem(new_id(), food.id, None, grams, food.nutrients_for(grams), photo_id, 0)
        elif custom_name and nutrients:
            item = ExtraItem(new_id(), None, custom_name, None, nutrients, photo_id, 0)
        else:
            raise ValidationFailed("請提供食物份量或自訂食物營養")

        profile = await self._accounts.load_profile(user_id)
        if profile is None:
            raise NotFound("還沒有建立個人資料")
        await self._days.add_extra(user_id, day, item, profile)
        return item

    async def remove(self, user_id: str, day: date, item_id: str) -> None:
        if not await self._days.delete_extra(user_id, day, item_id):
            raise NotFound("找不到這個額外餐點項目")
