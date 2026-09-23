"""套用 migrations/ 下的 .sql 檔。部署時由 Dockerfile CMD 呼叫。"""

import pathlib
import sys

from yoyo import get_backend, read_migrations

from app.config import settings

MIGRATIONS_DIR = pathlib.Path(__file__).resolve().parent.parent / "migrations"


def apply(db_path: str | None = None) -> int:
    target = db_path or settings.db_path
    pathlib.Path(target).parent.mkdir(parents=True, exist_ok=True)

    backend = get_backend(f"sqlite:///{target}")
    migrations = read_migrations(str(MIGRATIONS_DIR))
    with backend.lock():
        pending = backend.to_apply(migrations)
        backend.apply_migrations(pending)
    return len(pending)


if __name__ == "__main__":
    count = apply()
    print(f"applied {count} migration(s)", file=sys.stderr)
