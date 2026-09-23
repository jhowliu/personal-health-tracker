"""Use case 與外界之間的 seam。

每個 port 對應一個聚合,不是一張表 — adapter 內部愛 join 幾張表是它的事。
目前各有一個 SQLite adapter 與一個測試用 in-memory adapter。
"""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol

from app.domain.models import (
    Account,
    BodyLog,
    DayFacts,
    Exercise,
    MealTime,
    Profile,
    ScheduleEntry,
    TemplateItem,
    WorkoutTemplate,
)


@dataclass(frozen=True, slots=True)
class Credentials:
    user_id: str
    email: str
    password_hash: str | None


@dataclass(frozen=True, slots=True)
class DueReminder:
    user_id: str
    push_tokens: tuple[str, ...]
    locale: str


class Clock(Protocol):
    def now(self) -> datetime: ...

    def today(self, timezone: str) -> date: ...


class PasswordHasher(Protocol):
    def hash(self, password: str) -> str: ...

    def verify(self, password: str, password_hash: str) -> bool: ...


class TokenIssuer(Protocol):
    def issue_access(self, user_id: str) -> str: ...

    def issue_refresh(self) -> tuple[str, str, datetime]:
        """回傳 (原始 token, 儲存用雜湊, 到期時間)。"""

    def hash_refresh(self, raw: str) -> str: ...


class IdentityVerifier(Protocol):
    async def verify(self, provider: str, id_token: str) -> tuple[str, str | None]:
        """驗證第三方 ID token,回傳 (provider_subject, email)。"""


class PushSender(Protocol):
    async def send(self, tokens: tuple[str, ...], title: str, body: str) -> None: ...


class AccountStore(Protocol):
    async def create_account(
        self, account: Account, password_hash: str | None
    ) -> None: ...

    async def find_credentials(self, email: str) -> Credentials | None: ...

    async def find_by_identity(self, provider: str, subject: str) -> str | None: ...

    async def link_identity(
        self, provider: str, subject: str, user_id: str, email: str | None
    ) -> None: ...

    async def delete_account(self, user_id: str) -> None: ...

    async def save_refresh(self, user_id: str, token_hash: str, expires_at: datetime) -> None: ...

    async def consume_refresh(self, token_hash: str, now: datetime) -> str | None:
        """驗證並作廢一次性 refresh token,回傳 user_id;無效時 None。"""

    async def revoke_all_refresh(self, user_id: str) -> None: ...

    async def load_profile(self, user_id: str) -> Profile | None: ...

    async def save_profile(self, profile: Profile) -> None: ...


class BodyStore(Protocol):
    async def upsert(self, user_id: str, log: BodyLog) -> None: ...

    async def delete(self, user_id: str, day: date) -> None: ...

    async def range(self, user_id: str, since: date, until: date) -> tuple[BodyLog, ...]: ...


class TrainingStore(Protocol):
    async def list_exercises(self, user_id: str) -> tuple[Exercise, ...]: ...

    async def save_exercise(self, user_id: str, exercise: Exercise) -> None: ...

    async def archive_exercise(self, user_id: str, exercise_id: str) -> None: ...

    async def list_templates(
        self, user_id: str, location: str | None
    ) -> tuple[WorkoutTemplate, ...]: ...

    async def load_template(self, user_id: str, template_id: str) -> WorkoutTemplate | None: ...

    async def save_template(self, user_id: str, template: WorkoutTemplate) -> None: ...

    async def archive_template(self, user_id: str, template_id: str) -> None: ...

    async def replace_items(
        self, user_id: str, template_id: str, items: tuple[TemplateItem, ...]
    ) -> None: ...

    async def load_schedule(self, user_id: str) -> tuple[ScheduleEntry, ...]: ...

    async def replace_schedule(
        self, user_id: str, entries: tuple[ScheduleEntry, ...]
    ) -> None: ...


class DayStore(Protocol):
    async def load_facts(self, user_id: str, day: date, profile: Profile) -> DayFacts:
        """組出推算流程所需的全部事實(必要時建立當天的 days 列)。"""

    async def update_day(
        self,
        user_id: str,
        day: date,
        *,
        workout_time: str | None = None,
        location: str | None = None,
        steps: int | None = None,
        workout_done_at: datetime | None = None,
    ) -> None: ...

    async def mark_eaten(
        self, user_id: str, day: date, meal_time: MealTime, eaten_at: datetime
    ) -> None: ...

    async def log_set(
        self,
        user_id: str,
        day: date,
        template_item_id: str,
        exercise_id: str,
        set_index: int,
        reps_done: int | None,
        weight_kg: float | None,
        done_at: datetime,
    ) -> None: ...

    async def streak_until(self, user_id: str, day: date) -> int: ...


class ReminderStore(Protocol):
    async def register_device(
        self, user_id: str, push_token: str, platform: str, seen_at: datetime
    ) -> None: ...

    async def due_at(self, now: datetime) -> tuple[DueReminder, ...]:
        """找出此刻正好到提醒時間、且今天還沒量體重的使用者。"""
