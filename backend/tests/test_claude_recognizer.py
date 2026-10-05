import base64
import json

import httpx
import httpx2
import pytest

from app.adapters.ai.claude import ClaudeImageRecognizer
from app.adapters.ai.openai import OpenAIImageRecognizer
from app.api import deps
from app.domain.errors import ServiceUnavailable

PHOTO = "https://photos.example/meal.jpg"
JPEG = b"\xff\xd8not-really-a-jpeg"
ITEM = {
    "label": "糙米飯",
    "library_name": "糙米飯(熟)",
    "library_confidence": 0.7,
    "grams": 120,
    "confidence": 0.9,
    "category_id": "staple",
    "kcal_per_100g": 110,
    "protein_per_100g": 2.5,
    "fat_per_100g": 0.9,
    "carb_per_100g": 23,
}


def _message(content: list[dict], stop_reason: str = "end_turn") -> dict:
    return {
        "id": "msg_1",
        "type": "message",
        "role": "assistant",
        "model": "claude-opus-5-5",
        "content": content,
        "stop_reason": stop_reason,
        "stop_sequence": None,
        "usage": {"input_tokens": 2600, "output_tokens": 740},
    }


def _photo(request: httpx.Request) -> httpx.Response:
    assert str(request.url) == PHOTO
    return httpx.Response(200, content=JPEG, headers={"content-type": "image/jpeg"})


def _recognizer(handler, photo=_photo) -> ClaudeImageRecognizer:
    client = httpx2.AsyncClient(transport=httpx2.MockTransport(handler))
    return ClaudeImageRecognizer(
        "claude-key",
        "claude-opus-5-5",
        "low",
        max_retries=0,
        http_client=client,
        image_transport=httpx.MockTransport(photo),
    )


async def test_claude_reads_the_photo_with_the_shared_prompt() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        payload = json.loads(request.content)
        assert request.url.path == "/v1/messages"
        assert request.headers["x-api-key"] == "claude-key"
        assert "server-side-fallback-2026-07-01" in request.headers["anthropic-beta"]
        assert payload["model"] == "claude-opus-5-5"
        assert payload["fallbacks"] == "default"
        assert payload["output_config"]["effort"] == "low"
        assert payload["output_config"]["format"]["type"] == "json_schema"
        assert "- 糙米飯(熟)" in payload["system"]
        image, text = payload["messages"][0]["content"]
        # Sent as bytes, so Claude never has to reach the photo's link itself.
        assert image == {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": base64.b64encode(JPEG).decode(),
            },
        }
        assert text["text"] == "Return each visible food as JSON."
        return httpx2.Response(
            200, json=_message([{"type": "text", "text": json.dumps({"items": [ITEM]})}])
        )

    (rice,) = await _recognizer(handler).recognize(PHOTO, ("糙米飯(熟)", "板豆腐"))

    assert (rice.label, rice.grams, rice.confidence) == ("糙米飯", 120, 0.9)
    assert (rice.library_name, rice.library_confidence) == ("糙米飯(熟)", 0.7)
    assert rice.estimate.category_id == "staple"
    assert rice.estimate.per_100g.kcal == 110


async def test_a_declined_photo_says_to_add_the_food_by_hand() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=_message([], stop_reason="refusal"))

    with pytest.raises(ServiceUnavailable, match="手動加入"):
        await _recognizer(handler).recognize(PHOTO, ())


async def test_claude_errors_map_to_service_unavailable() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        error = {"type": "invalid_request_error", "message": "bad"}
        return httpx2.Response(400, json={"type": "error", "error": error})

    with pytest.raises(ServiceUnavailable, match="暫時不可用"):
        await _recognizer(handler).recognize(PHOTO, ())


async def test_a_photo_that_cannot_be_read_is_not_sent() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        raise AssertionError("Claude must not be called without the photo")

    def missing(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404)

    with pytest.raises(ServiceUnavailable, match="照片讀取失敗"):
        await _recognizer(handler, missing).recognize(PHOTO, ())


async def test_claude_requires_a_key() -> None:
    with pytest.raises(ServiceUnavailable, match="尚未設定"):
        await ClaudeImageRecognizer("", "claude-opus-5-5", "low").recognize(PHOTO, ())


def test_the_setting_picks_who_reads_photos(monkeypatch: pytest.MonkeyPatch) -> None:
    # The recognizer is built once per process; clear it around each setting.
    try:
        monkeypatch.setattr(deps.settings, "photo_recognizer", "anthropic")
        deps.image_recognizer.cache_clear()
        assert isinstance(deps.image_recognizer(), ClaudeImageRecognizer)
        monkeypatch.setattr(deps.settings, "photo_recognizer", "openai")
        deps.image_recognizer.cache_clear()
        assert isinstance(deps.image_recognizer(), OpenAIImageRecognizer)
    finally:
        deps.image_recognizer.cache_clear()
