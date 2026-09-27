import json

import httpx
import pytest

from app.adapters.ai.jev import JevDecisionEngine
from app.domain.decisions import DecisionOption, DecisionRequest
from app.domain.errors import ServiceUnavailable


async def test_jev_returns_selected_probability_as_confidence() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert request.url == "https://ai-gateway.vercel.sh/v1/evaluate"
        assert request.headers["Authorization"] == "Bearer gateway-key"
        assert payload["model"] == "typesafe-ai/jev"
        assert payload["state"] == {"subject": "香蕉"}
        assert payload["questions"]["selection"]["criteria"] == {
            "banana": "香蕉",
            "apple": "蘋果",
        }
        assert "providerOptions" not in payload
        return httpx.Response(
            200,
            json={
                "answers": {
                    "selection": {
                        "type": "choice",
                        "choice": "banana",
                        "probabilities": {"banana": 0.94, "apple": 0.06},
                    }
                }
            },
        )

    engine = JevDecisionEngine("gateway-key", transport=httpx.MockTransport(handler))
    result = await engine.decide(
        DecisionRequest(
            "香蕉",
            "Choose the matching food.",
            (DecisionOption("banana", "香蕉"), DecisionOption("apple", "蘋果")),
        )
    )

    assert result.selection_id == "banana"
    assert result.confidence == 0.94
    assert result.rationale is None


async def test_jev_requires_a_gateway_key() -> None:
    engine = JevDecisionEngine("")

    with pytest.raises(ServiceUnavailable, match="尚未設定"):
        await engine.decide(
            DecisionRequest("香蕉", "Choose.", (DecisionOption("banana", "香蕉"),))
        )


async def test_jev_maps_gateway_errors_to_service_unavailable() -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(401, json={"error": "bad key"}))
    engine = JevDecisionEngine("bad-key", transport=transport)

    with pytest.raises(ServiceUnavailable, match="暫時不可用"):
        await engine.decide(
            DecisionRequest("香蕉", "Choose.", (DecisionOption("banana", "香蕉"),))
        )
