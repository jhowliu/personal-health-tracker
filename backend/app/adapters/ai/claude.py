"""Meal-photo recognition with Claude, through the Anthropic SDK."""

import base64
import logging

import anthropic
import httpx
import httpx2

from app.adapters.ai.meal_photo import USER_TEXT, MealPhotoOutput, instructions, to_recognitions
from app.domain.errors import ServiceUnavailable
from app.domain.meal_photos import Recognition

log = logging.getLogger(__name__)

# A classifier decline is re-run server-side on the model Anthropic recommends for its
# category, instead of coming back as a refusal.
_FALLBACK_BETA = "server-side-fallback-2026-07-01"
# The photo download and two 40 s attempts stay inside the 100 s Cloudflare gives the request
# this runs in.
_DOWNLOAD_TIMEOUT_S = 10.0
_TIMEOUT_S = 40.0


class ClaudeImageRecognizer:
    def __init__(
        self,
        api_key: str,
        model: str,
        effort: str,
        *,
        max_retries: int = 1,
        http_client: httpx2.AsyncClient | None = None,
        image_transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._effort = effort
        self._max_retries = max_retries
        self._http_client = http_client
        self._image_transport = image_transport

    async def recognize(
        self, image_url: str, known_foods: tuple[str, ...]
    ) -> tuple[Recognition, ...]:
        if not self._api_key:
            raise ServiceUnavailable("AI 服務尚未設定，請稍後再試")
        image = await self._download(image_url)
        try:
            async with anthropic.AsyncAnthropic(
                api_key=self._api_key,
                timeout=_TIMEOUT_S,
                max_retries=self._max_retries,
                http_client=self._http_client,
            ) as client:
                response = await client.beta.messages.parse(
                    model=self._model,
                    max_tokens=16000,
                    system=instructions(known_foods),
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "image", "source": image},
                                {"type": "text", "text": USER_TEXT},
                            ],
                        }
                    ],
                    output_format=MealPhotoOutput,
                    output_config={"effort": self._effort},
                    betas=[_FALLBACK_BETA],
                    fallbacks="default",
                )
        except anthropic.APIStatusError as exc:
            log.warning("photo recognition: HTTP %s from Claude: %s", exc.status_code, exc.message)
            raise ServiceUnavailable("AI 服務暫時不可用") from exc
        except anthropic.APIConnectionError as exc:
            # Timeouts land here too.
            log.warning("photo recognition: no answer from Claude: %s", exc)
            raise ServiceUnavailable("AI 服務暫時不可用") from exc
        except ValueError as exc:
            # Unparseable JSON, or JSON outside the schema's limits (checked client-side).
            log.warning("photo recognition: output outside the schema: %s", exc)
            raise ServiceUnavailable("AI 服務暫時不可用") from exc

        if response.stop_reason == "refusal":
            log.warning("photo recognition: declined (%s)", getattr(response, "stop_details", None))
            raise ServiceUnavailable("這張照片無法辨識，請改用手動加入食物")
        if response.parsed_output is None:
            log.warning("photo recognition: no output (stop_reason=%s)", response.stop_reason)
            raise ServiceUnavailable("AI 服務暫時不可用")
        return to_recognitions(response.parsed_output)

    async def _download(self, image_url: str) -> dict[str, str]:
        """The photo as a base64 source. Claude is sent the bytes rather than the link, so it
        never has to reach our storage, and a link it cannot fetch is never the failure."""
        try:
            async with httpx.AsyncClient(
                timeout=_DOWNLOAD_TIMEOUT_S, transport=self._image_transport
            ) as client:
                response = await client.get(image_url)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            log.warning("photo recognition: could not read the photo: %s", exc)
            raise ServiceUnavailable("照片讀取失敗，請稍後再試") from exc
        media_type = response.headers.get("content-type", "").split(";")[0].strip()
        return {
            "type": "base64",
            "media_type": media_type if media_type in ("image/jpeg", "image/png") else "image/jpeg",
            "data": base64.b64encode(response.content).decode(),
        }
