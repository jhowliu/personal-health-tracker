from pathlib import Path

from app.config import Settings


def test_settings_loads_env_file_from_project_root() -> None:
    assert Path(Settings.model_config["env_file"]) == Path(__file__).resolve().parents[2] / ".env"
