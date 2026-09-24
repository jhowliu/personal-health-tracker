"""Meal-photo records and recognition values, independent of HTTP or AI vendors."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from app.domain.models import Nutrients


class MealPhotoStatus(StrEnum):
    UPLOADED = "uploaded"
    ANALYZING = "analyzing"
    DONE = "done"
    FAILED = "failed"


@dataclass(frozen=True, slots=True)
class MealPhoto:
    id: str
    user_id: str
    object_key: str
    status: MealPhotoStatus
    result_json: str | None
    created_at: datetime
    analyzed_at: datetime | None


@dataclass(frozen=True, slots=True)
class Recognition:
    label: str
    grams: float
    confidence: float


@dataclass(frozen=True, slots=True)
class RecognizedFood:
    food_id: str
    category_id: str
    label: str


@dataclass(frozen=True, slots=True)
class RecognizedItem:
    label: str
    category_id: str | None
    food_id: str | None
    grams: float
    confidence: float
    alternatives: tuple[RecognizedFood, ...]


@dataclass(frozen=True, slots=True)
class ExtraItem:
    id: str
    food_id: str | None
    custom_name: str | None
    grams: float | None
    nutrients: Nutrients
    photo_id: str | None
    sort_order: int
