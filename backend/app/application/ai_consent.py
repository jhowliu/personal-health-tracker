"""Whether the user agreed to send their data to the AI provider.

Asked the first time an AI feature is used, not at sign-up, since the app works without it.
Every AI call checks it here first.
"""

from app.application.ports import AiConsentStore, Clock
from app.domain.errors import ConsentRequired


class AiConsentService:
    def __init__(self, store: AiConsentStore, clock: Clock) -> None:
        self._store = store
        self._clock = clock

    async def given(self, user_id: str) -> bool:
        return await self._store.consented_at(user_id) is not None

    async def set(self, user_id: str, consent: bool) -> bool:
        """Agree, keeping the first time it was given, or withdraw."""
        if not consent:
            await self._store.set_consent(user_id, None)
        elif not await self.given(user_id):
            await self._store.set_consent(user_id, self._clock.now())
        return consent

    async def require(self, user_id: str) -> None:
        if not await self.given(user_id):
            raise ConsentRequired("請先同意使用 AI 分析")
