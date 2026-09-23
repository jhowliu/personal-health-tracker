"""Check that the committed openapi.json still matches the current routes.

When the backend changes a field but nobody regenerates the types, the frontend's tsc
passes in silence — it is reading the stale openapi.json. This script makes that fail in
CI instead of on the App screen.
"""

import difflib
import json
import sys

from app.main import app
from scripts.export_openapi import TARGET


def check() -> int:
    current = json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n"

    if not TARGET.exists():
        print(f"{TARGET} 不存在。跑:python -m scripts.export_openapi", file=sys.stderr)
        return 1

    committed = TARGET.read_text()
    if committed == current:
        print(f"{TARGET.name} 是最新的")
        return 0

    print(f"{TARGET} 過期了 —— 後端路由改了但沒重新產生。\n", file=sys.stderr)
    diff = difflib.unified_diff(
        committed.splitlines(keepends=True),
        current.splitlines(keepends=True),
        fromfile="committed",
        tofile="current",
        n=1,
    )
    sys.stderr.writelines(list(diff)[:40])
    print(
        "\n修法:\n"
        "  cd backend && python -m scripts.export_openapi\n"
        "  cd mobile && npm run api:types && npx tsc --noEmit",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(check())
