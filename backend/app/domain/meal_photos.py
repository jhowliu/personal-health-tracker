"""Meal-photo records and recognition values, independent of HTTP or AI vendors."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from app.domain.models import Food, Nutrients

# Each name costs the recognizer prompt about 8 tokens; this keeps a big library near 1.2k.
PROMPT_FOOD_LIMIT = 150


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
class EstimatedFood:
    category_id: str
    per_100g: Nutrients


@dataclass(frozen=True, slots=True)
class Recognition:
    label: str
    grams: float
    confidence: float
    estimate: EstimatedFood | None = None
    # Which of the user's foods the recognizer says this is, and how sure it is of that
    # pairing. Kept apart from `label` (what it saw) so a forced pick stays visible.
    library_name: str | None = None
    library_confidence: float = 0.0


def foods_for_prompt(
    library: tuple[Food, ...], recent_ids: tuple[str, ...], limit: int = PROMPT_FOOD_LIMIT
) -> tuple[str, ...]:
    """The food names to show the recognizer, capped so the prompt stays small.

    Recently logged foods come first (`recent_ids` is most recent first), then the defaults
    every account starts with, then everything else.
    """
    by_id = {food.id: food for food in library}
    recent = [by_id[food_id] for food_id in recent_ids if food_id in by_id]
    defaults = [food for food in library if food.template_id is not None]
    names = dict.fromkeys(food.name for food in (*recent, *defaults, *library))
    return tuple(names)[:limit]


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
    recognition_confidence: float
    match_confidence: float
    alternatives: tuple[RecognizedFood, ...]
    estimate: EstimatedFood | None = None
