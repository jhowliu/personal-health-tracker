"""The seam between use cases and the outside world.

Each port covers one aggregate, not one table — how many tables an adapter joins
inside is its own business.
"""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol

from app.domain.models import (
    Account,
    BodyLog,
    DayFacts,
    Exercise,
    Food,
    FoodCategory,
    Meal,
    MealItem,
    MealTime,
    PlannedMeal,
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
        """Returns (raw token, hash to store, expiry)."""

    def hash_refresh(self, raw: str) -> str: ...


class IdentityVerifier(Protocol):
    async def verify(self, provider: str, id_token: str) -> tuple[str, str | None]:
        """Verify a third-party ID token. Returns (provider_subject, email)."""


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
        """Validate and burn a single-use refresh token. Returns the user_id, or None."""

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
        """Assemble the facts needed to derive the flow, creating the day row if missing."""

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

    async def load_plan(self, user_id: str, day: date) -> tuple[PlannedMeal, ...]:
        """What is on the plate today, as stored — grams already scaled and swapped."""

    async def save_plan(
        self,
        user_id: str,
        day: date,
        meals: dict[MealTime, tuple[str, str, tuple[MealItem, ...]]],
        profile: Profile,
    ) -> None:
        """Write the snapshot for the given slots as (meal_id, name, items).

        Takes the profile because day_meals hangs off a days row, which may not exist
        yet — the plan can be the first thing that touches a given date.

        Slots already marked eaten are left alone: what someone already ate is a fact,
        not something a reshuffle gets to rewrite.
        """

    async def replace_plan_item(
        self, user_id: str, day: date, meal_time: MealTime, item_id: str, food_id: str, grams: float
    ) -> None:
        """Swap one food in today's plate, keeping its position in the meal."""


class FoodStore(Protocol):
    async def categories(self) -> tuple[FoodCategory, ...]: ...

    async def search(
        self, user_id: str, query: str | None, category_id: str | None
    ) -> tuple[Food, ...]:
        """Browse or search the library. Matches names and aliases; built-ins plus the
        user's own foods.
        """

    async def load(self, user_id: str, food_id: str) -> Food | None: ...

    async def in_category(self, user_id: str, category_id: str) -> tuple[Food, ...]:
        """Swap candidates: everything in the same category."""

    async def save_custom(self, user_id: str, food: Food) -> None: ...

    async def archive_custom(self, user_id: str, food_id: str) -> None: ...


class MealStore(Protocol):
    async def list(
        self, user_id: str, meal_time: MealTime | None, query: str | None
    ) -> tuple[Meal, ...]: ...

    async def load(self, user_id: str, meal_id: str) -> Meal | None: ...

    async def save(self, user_id: str, meal: Meal) -> None:
        """Upsert the meal along with its slots and items."""

    async def archive(self, user_id: str, meal_id: str) -> None: ...


class ReminderStore(Protocol):
    async def register_device(
        self, user_id: str, push_token: str, platform: str, seen_at: datetime
    ) -> None: ...

    async def due_at(self, now: datetime) -> tuple[DueReminder, ...]:
        """Users whose reminder time is right now and who have not logged a weight today."""
