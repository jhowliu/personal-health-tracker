"""OpenAI implementations of image recognition and bounded decisions."""

import json

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.adapters.ai.meal_photo import USER_TEXT, MealPhotoOutput, instructions, to_recognitions
from app.domain.decisions import DecisionRequest, DecisionResult
from app.domain.errors import ServiceUnavailable
from app.domain.meal_photos import Recognition


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
        output = await self._structured(
            "meal_photo",
            MealPhotoOutput,
            [
                {"role": "system", "content": instructions(known_foods)},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": USER_TEXT},
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ],
                },
            ],
        )
        assert isinstance(output, MealPhotoOutput)
        return to_recognitions(output)
