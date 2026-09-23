from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import aiosqlite

from app.config import settings


async def _init_conn(conn: aiosqlite.Connection) -> None:
    await conn.execute("PRAGMA journal_mode = WAL")
    await conn.execute("PRAGMA foreign_keys = ON")
    await conn.execute("PRAGMA busy_timeout = 5000")
    await conn.execute("PRAGMA synchronous = NORMAL")
    conn.row_factory = aiosqlite.Row


@asynccontextmanager
async def get_conn() -> AsyncIterator[aiosqlite.Connection]:
    async with aiosqlite.connect(settings.db_path) as conn:
        await _init_conn(conn)
        try:
            yield conn
        finally:
            await conn.commit()


async def db_dep() -> AsyncIterator[aiosqlite.Connection]:
    async with get_conn() as conn:
        yield conn


async def verify_schema() -> None:
    """啟動時就確認 migration 跑過了。

    aiosqlite 連不存在的檔案會安靜地建一個空的,不擋在這裡的話,
    第一個錯誤會是排程工作一分鐘後丟出來的 "no such table",看不出真正的原因。
    """
    async with get_conn() as conn:
        async with conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'profiles'"
        ) as cursor:
            if await cursor.fetchone() is None:
                raise RuntimeError(
                    f"資料庫 {settings.db_path} 還沒有建表。"
                    f" 先跑:DB_PATH={settings.db_path} python -m scripts.migrate"
                )
