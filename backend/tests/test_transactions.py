"""The request is one transaction: kept when it succeeds, undone when it fails."""

import aiosqlite
import pytest
from httpx import AsyncClient

from app.api.deps import DbConn
from app.config import settings
from app.db import get_conn
from app.domain.errors import ServiceUnavailable
from app.main import app


async def _device_tokens() -> list[str]:
    async with aiosqlite.connect(settings.db_path) as conn:
        rows = await (await conn.execute("SELECT push_token FROM devices")).fetchall()
    return [row[0] for row in rows]


async def _insert_device(conn: aiosqlite.Connection, user_id: str, token: str) -> None:
    await conn.execute(
        "INSERT INTO devices (id, user_id, push_token, platform) VALUES (?, ?, ?, 'ios')",
        (token, user_id, token),
    )


async def _user_id() -> str:
    async with aiosqlite.connect(settings.db_path) as conn:
        return (await (await conn.execute("SELECT id FROM users")).fetchone())[0]


async def test_writes_are_kept_when_the_block_finishes(signed_in: AsyncClient):
    user_id = await _user_id()

    async with get_conn() as conn:
        await _insert_device(conn, user_id, "kept")

    assert await _device_tokens() == ["kept"]


async def test_writes_are_undone_when_the_block_raises(signed_in: AsyncClient):
    user_id = await _user_id()

    with pytest.raises(RuntimeError):
        async with get_conn() as conn:
            await _insert_device(conn, user_id, "undone")
            raise RuntimeError("boom")

    assert await _device_tokens() == []


async def test_a_failed_request_leaves_no_partial_write(signed_in: AsyncClient):
    user_id = await _user_id()

    async def half_done(conn: DbConn) -> None:
        await _insert_device(conn, user_id, "half")
        raise ServiceUnavailable("下游壞了")

    routes = list(app.router.routes)
    app.add_api_route("/_test/half-done", half_done, methods=["POST"], dependencies=[])
    try:
        response = await signed_in.post("/_test/half-done")
    finally:
        app.router.routes[:] = routes

    assert response.status_code == 503
    assert await _device_tokens() == []


