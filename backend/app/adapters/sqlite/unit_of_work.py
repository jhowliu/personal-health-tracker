import aiosqlite


class SqliteUnitOfWork:
    def __init__(self, conn: aiosqlite.Connection) -> None:
        self._conn = conn

    async def commit(self) -> None:
        await self._conn.commit()
