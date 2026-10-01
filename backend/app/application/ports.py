"""The seam between use cases and the outside world.

Each port covers one aggregate, not one table — how many tables an adapter joins
inside is its own business.
"""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol

from app.domain.decisions import DecisionRequest, DecisionResult
from app.domain.meal_photos import MealPhoto, Recognition
from app.domain.models import (
    Account,
    BodyLog,
    DayFacts,
    Exercise,
    Food,
    FoodCategory,
    Meal,
    MealTime,
    PlannedMeal,
    PlateItem,
    Profile,
    ScheduleEntry,
    TemplateItem,
    WorkoutTemplate,
)
from app.domain.streak import DayRecord
from app.domain.workout_execution import DayWorkoutItem, SetLog, WorkoutExecution


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


class UnitOfWork(Protocol):
    """The request's transaction: committed when the request succeeds, rolled back when it fails."""

    async def commit(self) -> None:
        """Make everything written so far durable, even if the request fails afterwards."""


class Clock(Protocol):
    def now(self) -> datetime: ...

    def today(self, timezone: str) -> date: ...


class PasswordHasher(Protocol):
    def hash(self, password: str) -> str: ...

    def verify(self, password: str, password_hash: str) -> bool: ...


class TokenIssuer(Protocol):
    def issue_access(self, user_id: str) -> str: ...

    def user_id_from_access(self, token: str) -> str | None:
        """The user an access token was issued to; None when it is invalid or expired."""

    def issue_refresh(self) -> tuple[str, str, datetime]:
        """Returns (raw token, hash to store, expiry)."""

    def hash_refresh(self, raw: str) -> str: ...


class IdentityVerifier(Protocol):
    async def verify(self, provider: str, id_token: str) -> tuple[str, str | None]:
        """Verify a third-party ID token. Returns (provider_subject, email)."""


class PushSender(Protocol):
    async def send(self, tokens: tuple[str, ...], title: str, body: str) -> None: ...


class AccountStore(Protocol):
    async def create_account(self, account: Account, password_hash: str | None) -> None: ...

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
    async def search_exercises(
        self,
        user_id: str,
        *,
        query: str | None,
        category_id: str | None,
        body_region: str | None,
        equipment: str | None,
    ) -> tuple[Exercise, ...]: ...

    async def load_exercise(self, user_id: str, exercise_id: str) -> Exercise | None: ...

    async def save_exercise(self, user_id: str, exercise: Exercise) -> None: ...

    async def archive_exercise(self, user_id: str, exercise_id: str) -> None: ...

    async def exercise_categories(self) -> tuple[tuple[str, str], ...]: ...

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

    async def replace_schedule(self, user_id: str, entries: tuple[ScheduleEntry, ...]) -> None: ...


class WorkoutExecutionStore(Protocol):
    async def load(self, user_id: str, day: date) -> WorkoutExecution:
        """The day's workout, opening the day and copying the scheduled template if needed."""

    async def load_visible_exercise(self, user_id: str, exercise_id: str) -> Exercise | None: ...

    async def add_item(self, user_id: str, day: date, item: DayWorkoutItem) -> None: ...

    async def update_item(
        self,
        user_id: str,
        day: date,
        item: DayWorkoutItem,
        *,
        replacing: bool,
    ) -> bool: ...

    async def delete_item(self, user_id: str, day: date, item_id: str) -> bool: ...

    async def log_set(self, user_id: str, day: date, log: SetLog) -> None: ...

    async def apply_template_weight(
        self, user_id: str, template_id: str, item_id: str, weight_kg: float
    ) -> bool: ...


class DayStore(Protocol):
    """Everything stored about one Day. Every method opens the Day first (idempotent), so
    callers never create it themselves; a user without a profile gets NotFound.
    """

    async def load_facts(self, user_id: str, day: date) -> DayFacts:
        """Assemble the facts needed to derive the flow."""

    async def update_day(
        self,
        user_id: str,
        day: date,
        *,
        workout_time: str | None = None,
        workout_state: str | None = None,
        workout_state_at: datetime | None = None,
    ) -> None: ...

    async def set_meal_state(
        self,
        user_id: str,
        day: date,
        meal_time: MealTime,
        state: str,
        at: datetime,
    ) -> None: ...

    async def recent_days(self, user_id: str, until: date, limit: int) -> tuple[DayRecord, ...]:
        """Up to `limit` opened days ending at `until`, newest first."""

    async def load_plan(self, user_id: str, day: date) -> tuple[PlannedMeal, ...]:
        """What is on the plate today, as stored — grams already scaled and swapped."""

    async def replace_plan_item(
        self, user_id: str, day: date, meal_time: MealTime, item_id: str, food_id: str, grams: float
    ) -> None:
        """Swap one food in today's plate, keeping its position in the meal."""

    async def add_plan_item(
        self, user_id: str, day: date, meal_time: MealTime, item: PlateItem
    ) -> None: ...

    async def update_plan_item(
        self, user_id: str, day: date, meal_time: MealTime, item_id: str, grams: float
    ) -> bool: ...

    async def delete_plan_item(
        self, user_id: str, day: date, meal_time: MealTime, item_id: str
    ) -> bool: ...

    async def link_meal(self, user_id: str, day: date, meal_time: MealTime, meal_id: str) -> None:
        """Name an existing slot after the saved meal now filling it."""

    async def load_extras(self, user_id: str, day: date) -> tuple[PlateItem, ...]: ...

    async def add_extra(self, user_id: str, day: date, item: PlateItem) -> None: ...

    async def delete_extra(self, user_id: str, day: date, item_id: str) -> bool: ...


class FoodStore(Protocol):
    async def categories(self) -> tuple[FoodCategory, ...]: ...

    async def search(
        self, user_id: str, query: str | None, category_id: str | None
    ) -> tuple[Food, ...]:
        """Browse active foods owned by the user, matching names and aliases."""

    async def load(self, user_id: str, food_id: str) -> Food | None:
        """A food the user can pick today: theirs and not archived."""

    async def load_referenced(self, user_id: str, food_id: str) -> Food | None:
        """A food the user owns, archived or not: for what already refers to it (meals, days)."""

    async def in_category(self, user_id: str, category_id: str) -> tuple[Food, ...]:
        """Swap candidates: everything in the same category."""

    async def recently_logged(self, user_id: str, since: date) -> tuple[str, ...]:
        """Ids of foods on the user's days from `since` on, most recently logged first."""

    async def seed_defaults(self, user_id: str) -> None:
        """Give the user their own copy of every default food they do not have yet.

        Never restores or overwrites a copy the user edited or archived.
        """

    async def save(self, user_id: str, food: Food) -> None:
        """Insert or update one of the user's own foods; another user's id is left alone."""

    async def archive(self, user_id: str, food_id: str) -> None: ...


class MealStore(Protocol):
    async def list(
        self, user_id: str, meal_time: MealTime | None, query: str | None
    ) -> tuple[Meal, ...]: ...

    async def load(self, user_id: str, meal_id: str) -> Meal | None: ...

    async def save(self, user_id: str, meal: Meal) -> None:
        """Upsert the meal along with its slots and items."""

    async def archive(self, user_id: str, meal_id: str) -> None: ...


class MealPhotoStore(Protocol):
    async def create(self, photo: MealPhoto) -> None: ...

    async def load(self, user_id: str, photo_id: str) -> MealPhoto | None: ...

    async def begin_analysis(
        self, user_id: str, photo_id: str, now: datetime, stale_before: datetime
    ) -> bool:
        """Claim the photo for analysis. True for exactly one caller: the photo was uploaded,
        or an earlier claim started before `stale_before` and was abandoned."""

    async def finish_analysis(
        self, user_id: str, photo_id: str, status: str, result_json: str
    ) -> None: ...

    async def analyses_on(self, user_id: str, day: date) -> int: ...


class ObjectStorage(Protocol):
    async def create_upload_url(
        self, user_id: str, photo_id: str, content_type: str
    ) -> tuple[str, str]:
        """Return the user-scoped object key and a short-lived PUT URL."""

    async def create_download_url(self, object_key: str) -> str: ...

    async def exists(self, object_key: str) -> bool: ...


class ImageRecognizer(Protocol):
    async def recognize(
        self, image_url: str, known_foods: tuple[str, ...]
    ) -> tuple[Recognition, ...]:
        """`known_foods` are the user's library names; reusing one verbatim lets it match."""
        ...


class DecisionEngine(Protocol):
    async def decide(self, request: DecisionRequest) -> DecisionResult: ...


class ReminderStore(Protocol):
    async def register_device(
        self, user_id: str, push_token: str, platform: str, seen_at: datetime
    ) -> None: ...

    async def due_at(self, now: datetime) -> tuple[DueReminder, ...]:
        """Users whose reminder time is right now and who have not logged a weight today."""
