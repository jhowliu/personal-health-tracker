"""Opening a Day is idempotent and independent of which call comes first."""

from datetime import UTC, date, datetime

import aiosqlite
import pytest
from httpx import AsyncClient

from app.adapters.sqlite.days import SqliteDayStore
from app.adapters.sqlite.foods import SqliteFoodStore
from app.adapters.sqlite.workout_execution import SqliteWorkoutExecutionStore
from app.config import settings
from app.db import get_conn
from app.domain.errors import NotFound
from app.domain.models import MealTime, WorkoutTime

DAY = date(2026, 9, 22)
NOW = datetime(2026, 9, 22, 12, 0, tzinfo=UTC)


def _days(conn) -> SqliteDayStore:
    return SqliteDayStore(conn, SqliteFoodStore(conn))


async def _user_id() -> str:
    async with aiosqlite.connect(settings.db_path) as conn:
        row = await (await conn.execute("SELECT id FROM users")).fetchone()
    return row[0]


async def _counts(user_id: str) -> tuple[int, int]:
    async with aiosqlite.connect(settings.db_path) as conn:
        days = await (
            await conn.execute("SELECT COUNT(*) FROM days WHERE user_id = ?", (user_id,))
        ).fetchone()
        meals = await (
            await conn.execute("SELECT COUNT(*) FROM day_meals WHERE user_id = ?", (user_id,))
        ).fetchone()
    return days[0], meals[0]


async def test_opening_a_day_twice_changes_nothing(with_profile: AsyncClient):
    user_id = await _user_id()

    async with get_conn() as conn:
        store = _days(conn)
        first = await store.load_facts(user_id, DAY)
        second = await store.load_facts(user_id, DAY)

    assert first == second
    assert first.workout_time is WorkoutTime.PM  # copied from the profile default
    assert await _counts(user_id) == (1, 3)


async def test_any_call_can_open_the_day_first(with_profile: AsyncClient):
    user_id = await _user_id()

    async with get_conn() as conn:
        store = _days(conn)
        await store.set_meal_state(user_id, DAY, MealTime.LUNCH, "skipped", NOW)
        await store.update_day(user_id, day=DAY, workout_state="done", workout_state_at=NOW)
        await SqliteWorkoutExecutionStore(conn).load(user_id, DAY)
        facts = await store.load_facts(user_id, DAY)

    assert await _counts(user_id) == (1, 3)
    assert facts.workout_done_at is not None
    assert next(s for s in facts.slots if s.meal_time is MealTime.LUNCH).skipped_at is not None


async def test_a_user_without_a_profile_cannot_open_a_day(signed_in: AsyncClient):
    user_id = await _user_id()

    async with get_conn() as conn:
        with pytest.raises(NotFound, match="個人資料"):
            await _days(conn).load_facts(user_id, DAY)
        with pytest.raises(NotFound, match="個人資料"):
            await SqliteWorkoutExecutionStore(conn).load(user_id, DAY)

    assert await _counts(user_id) == (0, 0)


async def test_a_meal_can_be_eaten_without_the_day_being_opened_first(with_profile: AsyncClient):
    user_id = await _user_id()

    async with get_conn() as conn:
        await _days(conn).set_meal_state(user_id, DAY, MealTime.BREAKFAST, "eaten", NOW)

    assert await _counts(user_id) == (1, 3)
