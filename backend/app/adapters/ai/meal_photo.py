"""The meal-photo task every recognizer runs: one prompt, one output schema, one mapping.

Kept apart from any one provider so swapping the model never changes what it is asked.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.meal_photos import EstimatedFood, Recognition
from app.domain.models import Nutrients

USER_TEXT = "Return each visible food as JSON."


class RecognizedImageItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str = Field(min_length=1, max_length=120)
    library_name: str | None = Field(max_length=120)
    library_confidence: float = Field(ge=0, le=1)
    grams: float = Field(gt=0, le=5000)
    confidence: float = Field(ge=0, le=1)
    category_id: Literal["staple", "protein", "vegetable", "fruit", "fat_sauce"]
    kcal_per_100g: float = Field(ge=0, le=1000)
    protein_per_100g: float = Field(ge=0, le=100)
    fat_per_100g: float = Field(ge=0, le=100)
    carb_per_100g: float = Field(ge=0, le=100)


class MealPhotoOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[RecognizedImageItem] = Field(max_length=20)


def instructions(known_foods: tuple[str, ...]) -> str:
    library = "\n".join(f"- {name}" for name in known_foods) or "(none)"
    return (
        "Identify visible food items. For each one:\n"
        "- label: a short food name for what it looks like (a name such as "
        "豬肉片 or 糙米飯, not a description), in Traditional Chinese as commonly "
        "used in Taiwan.\n"
        "- library_name: the user's food below that is the same food, copied "
        "exactly as written; null when none of them is. A similar food is not "
        "the same food: pork belly is not pork collar, white rice is not brown "
        "rice.\n"
        "- library_confidence: how sure you are that library_name is the same "
        "food; 0 when it is null.\n"
        "Estimate edible grams conservatively. Also estimate the closest allowed "
        "category and macronutrients per 100g.\n"
        f"User's foods:\n{library}"
    )


def to_recognitions(output: MealPhotoOutput) -> tuple[Recognition, ...]:
    return tuple(
        Recognition(
            item.label,
            item.grams,
            item.confidence,
            EstimatedFood(
                item.category_id,
                Nutrients(
                    item.kcal_per_100g,
                    item.protein_per_100g,
                    item.fat_per_100g,
                    item.carb_per_100g,
                ),
            ),
            item.library_name,
            item.library_confidence if item.library_name else 0.0,
        )
        for item in output.items
    )
