"""OpenAI implementations of image recognition and bounded decisions."""

import json
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.domain.decisions import DecisionRequest, DecisionResult
from app.domain.errors import ServiceUnavailable
from app.domain.meal_photos import EstimatedFood, Recognition
from app.domain.models import Nutrients


class _RecognizedImageItem(BaseModel):
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


class _ImageOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[_RecognizedImageItem] = Field(max_length=20)


class _DecisionOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    selection_id: str | None = Field(max_length=120)
    confidence: float = Field(ge=0, le=1)
    rationale: str | None = Field(max_length=500)


class OpenAIDecisionEngine:
    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model

    async def decide(self, request: DecisionRequest) -> DecisionResult:
        options = json.dumps(
            [{"id": option.id, "label": option.label} for option in request.options]
        )
        output = await self._structured(
            "decision",
            _DecisionOutput,
            [
                {"role": "system", "content": "Return only the requested JSON."},
                {
                    "role": "user",
                    "content": (
                        f"{request.instruction}\nSubject: {request.subject}\n"
                        f"Allowed options: {options}"
                    ),
                },
            ],
        )
        return DecisionResult(output.selection_id, output.confidence, output.rationale)

    async def _structured(
        self, name: str, output_type: type[BaseModel], messages: list[dict[str, object]]
    ) -> BaseModel:
        if not self._api_key:
            raise ServiceUnavailable("AI 服務尚未設定，請稍後再試")
        payload = {
            "model": self._model,
            "messages": messages,
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": name,
                    "strict": True,
                    "schema": output_type.model_json_schema(),
                },
            },
        }
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json=payload,
                )
                response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            return output_type.model_validate_json(content)
        except (
            httpx.HTTPError,
            KeyError,
            IndexError,
            TypeError,
            ValidationError,
            ValueError,
        ) as exc:
            raise ServiceUnavailable("AI 服務暫時不可用") from exc


class OpenAIImageRecognizer(OpenAIDecisionEngine):
    async def recognize(
        self, image_url: str, known_foods: tuple[str, ...]
    ) -> tuple[Recognition, ...]:
        library = "\n".join(f"- {name}" for name in known_foods) or "(none)"
        output = await self._structured(
            "meal_photo",
            _ImageOutput,
            [
                {
                    "role": "system",
                    "content": (
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
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Return each visible food as JSON."},
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ],
                },
            ],
        )
        assert isinstance(output, _ImageOutput)
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
