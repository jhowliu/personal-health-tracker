"""Write the OpenAPI spec into mobile/, where the frontend generates its types from it."""

import json
import pathlib

from app.main import app

TARGET = (
    pathlib.Path(__file__).resolve().parent.parent.parent
    / "mobile" / "src" / "api" / "openapi.json"
)


def export() -> pathlib.Path:
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n")
    return TARGET


if __name__ == "__main__":
    print(export())
