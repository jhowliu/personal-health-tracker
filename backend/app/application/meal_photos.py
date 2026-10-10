"""Meal-photo upload, recognition, and confirmation of extra food items."""

import json
from datetime import date, timedelta

from app.application.ai_consent import AiConsentService
from app.application.decisions import DecisionService
from app.application.plate_intake import PlateIntake
from app.application.ports import (
    Clock,
    DayStore,
    FoodStore,
    ImageRecognizer,
    MealPhotoStore,
    ObjectStorage,
    UnitOfWork,
)
from app.domain.errors import NotFound, QuotaExceeded, ServiceUnavailable, ValidationFailed
from app.domain.ids import new_id
from app.domain.meal_photos import (
    MealPhoto,
    MealPhotoStatus,
    Recognition,
    RecognizedFood,
    RecognizedItem,
    foods_for_prompt,
    with_kcal_from_macros,
)
from app.domain.models import Food, Nutrients, PlateItem

_IMAGE_TYPES = {"image/jpeg", "image/png"}
_CANDIDATE_LIMIT = 10
_ALTERNATIVE_LIMIT = 3
# Foods logged this recently go to the front of the names the recognizer is shown.
_RECENT_WINDOW = timedelta(days=60)
# An ANALYZING claim older than this was abandoned (the server died mid-call) and can be
# retried. Well past the recognizer's longest wait (the photo download and two 40 s attempts),
# so a live analysis is never taken over.
_ANALYSIS_LEASE = timedelta(minutes=2)


def _named(library: tuple[Food, ...], name: str | None) -> Food | None:
    """The library food the recognizer named, if the name really is one of them."""
    if not name:
        return None
    wanted = name.strip().casefold()
    return next((food for food in library if food.name.strip().casefold() == wanted), None)


class MealPhotoService:
    def __init__(
        self,
        photos: MealPhotoStore,
        objects: ObjectStorage,
        recognizer: ImageRecognizer,
        foods: FoodStore,
        decisions: DecisionService,
        clock: Clock,
        uow: UnitOfWork,
        daily_quota: int,
        consent: AiConsentService,
    ) -> None:
        self._photos = photos
        self._objects = objects
        self._recognizer = recognizer
        self._foods = foods
        self._decisions = decisions
        self._clock = clock
        self._uow = uow
        self._daily_quota = daily_quota
        self._consent = consent

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
        # The photo goes to the AI provider, which the user has to have agreed to.
        await self._consent.require(user_id)
        now = self._clock.now()
        today = now.date()
        if await self._photos.analyses_on(user_id, today) >= self._daily_quota:
            raise QuotaExceeded("今天的照片辨識額度已用完")

        photo = await self._photos.load(user_id, photo_id)
        if photo is None:
            raise NotFound("找不到這張照片")
        if not await self._photos.begin_analysis(user_id, photo_id, now, now - _ANALYSIS_LEASE):
            raise ValidationFailed("這張照片目前不能辨識")
        # Commit the claim before the model call. From here the ANALYZING status keeps a
        # second request off this photo; an open transaction would instead hold SQLite's one
        # write lock, everyone's, for the 10-20 s the model takes.
        await self._uow.commit()

        try:
            if not await self._objects.exists(photo.object_key):
                raise ValidationFailed("照片尚未完成上傳，請重新選擇照片")
            # Library search is substring-based, so "豬肉" never finds "梅花豬(熟)". Showing the
            # recognizer the user's own names lets it pair what it sees with a library food.
            library = await self._foods.search(user_id, None, None)
            recent = await self._foods.recently_logged(user_id, today - _RECENT_WINDOW)
            recognized = await self._recognizer.recognize(
                await self._objects.create_download_url(photo.object_key),
                foods_for_prompt(library, recent),
            )
            items = await self._match_foods(user_id, recognized, library)
            raw = json.dumps(
                {
                    "items": [
                        {
                            "label": item.label,
                            "library_name": source.library_name,
                            "grams": item.grams,
                            "recognition_confidence": item.recognition_confidence,
                            "match_confidence": item.match_confidence,
                            "food_id": item.food_id,
                            "estimate": (
                                {
                                    "category_id": item.estimate.category_id,
                                    "kcal_per_100g": item.estimate.per_100g.kcal,
                                    "protein_per_100g": item.estimate.per_100g.protein_g,
                                    "fat_per_100g": item.estimate.per_100g.fat_g,
                                    "carb_per_100g": item.estimate.per_100g.carb_g,
                                }
                                if item.estimate
                                else None
                            ),
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
            # The request is about to fail and roll back; the FAILED status must outlive it.
            await self._uow.commit()
            raise

    async def _match_foods(
        self, user_id: str, recognized: tuple[Recognition, ...], library: tuple[Food, ...]
    ) -> tuple[RecognizedItem, ...]:
        items: list[RecognizedItem] = []
        for item in recognized:
            candidates = await self._candidates(user_id, item.label)
            paired = _named(library, item.library_name)
            if paired is not None:
                # Only as sure as the recognizer says: a near miss it was pushed into (pork
                # belly for pork collar) must still ask the user to confirm.
                selected, confidence = paired, item.library_confidence
            else:
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
                    recognition_confidence=item.confidence,
                    match_confidence=confidence,
                    alternatives=tuple(
                        RecognizedFood(food.id, food.category_id, food.name)
                        for food in ordered[:_ALTERNATIVE_LIMIT]
                    ),
                    # A pairing keeps the estimate of what was actually seen, so the screen can
                    # fall back to it when the pairing turns out wrong.
                    estimate=(
                        with_kcal_from_macros(item.estimate)
                        if selected is None or paired is not None
                        else None
                    ),
                )
            )
        return tuple(items)

    async def _candidates(self, user_id: str, label: str) -> tuple[Food, ...]:
        """Shortlist the library foods a label could mean, matching names and aliases."""
        return (await self._foods.search(user_id, label, None))[:_CANDIDATE_LIMIT]

    async def _pick(self, label: str, candidates: tuple[Food, ...]) -> tuple[Food | None, float]:
        """Ask the decision layer which candidate the label means.

        Falls back to the best search hit at zero confidence whenever the layer is
        unavailable or unsure. That is what the spec asks for: still pre-fill something, but
        mark it as needing confirmation rather than pretending to be sure.
        """
        if not candidates:
            return None, 0.0
        normalized_label = label.strip().casefold()
        exact = tuple(
            food
            for food in candidates
            if normalized_label
            in {food.name.strip().casefold(), *(alias.strip().casefold() for alias in food.aliases)}
        )
        if len(exact) == 1:
            return exact[0], 1.0
        try:
            result = await self._decisions.food_match(label, candidates)
        except ServiceUnavailable:
            return candidates[0], 0.0
        selected = next((food for food in candidates if food.id == result.selection_id), None)
        if selected is None:
            return candidates[0], 0.0
        return selected, result.confidence


class ExtrasService:
    def __init__(self, days: DayStore, intake: PlateIntake) -> None:
        self._days = days
        self._intake = intake

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
    ) -> PlateItem:
        # Extras are recorded after the fact, so a known food is frozen the moment it is saved.
        item = (
            await self._intake.item(
                user_id,
                food_id=food_id,
                grams=grams,
                custom_name=custom_name,
                nutrients=nutrients,
                photo_id=photo_id,
            )
        ).freeze()
        await self._days.add_extra(user_id, day, item)
        return item

    async def remove(self, user_id: str, day: date, item_id: str) -> None:
        if not await self._days.delete_extra(user_id, day, item_id):
            raise NotFound("找不到這個額外餐點項目")
