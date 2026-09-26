"""Bounded decisions through TypeSafe AI Jev on Vercel AI Gateway."""

from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, ValidationError

from app.domain.decisions import DecisionRequest, DecisionResult
from app.domain.errors import ServiceUnavailable

_EVALUATE_URL = "https://ai-gateway.vercel.sh/v1/evaluate"


class _ChoiceAnswer(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: Literal["choice"]
    choice: str
    probabilities: dict[str, float]


class _EvaluationAnswers(BaseModel):
    model_config = ConfigDict(extra="ignore")

    selection: _ChoiceAnswer


class _EvaluationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    answers: _EvaluationAnswers


class JevDecisionEngine:
    def __init__(
        self,
        api_key: str,
        model: str = "typesafe-ai/jev",
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._transport = transport

    async def decide(self, request: DecisionRequest) -> DecisionResult:
        if not self._api_key:
            raise ServiceUnavailable("AI 決策服務尚未設定，請稍後再試")
        if not request.options:
            return DecisionResult(None, 0.0, "沒有可選項目")

        payload = {
            "model": self._model,
            "state": {"subject": request.subject},
            "questions": {
                "selection": {
                    "type": "choice",
                    "instructions": request.instruction,
                    "criteria": {option.id: option.label for option in request.options},
                }
            },
        }
        try:
            async with httpx.AsyncClient(timeout=30, transport=self._transport) as client:
                response = await client.post(
                    _EVALUATE_URL,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json=payload,
                )
                response.raise_for_status()
            answer = _EvaluationResponse.model_validate(response.json()).answers.selection
            confidence = answer.probabilities.get(answer.choice, 0.0)
            return DecisionResult(answer.choice, confidence, None)
        except (httpx.HTTPError, ValidationError, TypeError, ValueError) as exc:
            raise ServiceUnavailable("AI 決策服務暫時不可用") from exc
