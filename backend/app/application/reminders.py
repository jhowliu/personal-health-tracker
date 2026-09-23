"""每天早上提醒量體重。排程器每分鐘呼叫 dispatch_due 一次。"""

from datetime import datetime

from app.application.ports import Clock, PushSender, ReminderStore

TITLE = "早安,先量一下"
BODY = "起床、上完廁所、還沒吃喝前量最準。"


class ReminderService:
    def __init__(self, store: ReminderStore, push: PushSender, clock: Clock) -> None:
        self._store = store
        self._push = push
        self._clock = clock

    async def register_device(self, user_id: str, push_token: str, platform: str) -> None:
        await self._store.register_device(user_id, push_token, platform, self._clock.now())

    async def dispatch_due(self, now: datetime | None = None) -> int:
        due = await self._store.due_at(now or self._clock.now())
        for reminder in due:
            await self._push.send(reminder.push_tokens, TITLE, BODY)
        return len(due)
