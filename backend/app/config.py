from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_PROJECT_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_PROJECT_ENV_FILE, extra="ignore")

    db_path: str = "/data/pht.sqlite"

    jwt_secret: str = "dev-secret-change-me"
    jwt_access_ttl_min: int = 30
    jwt_refresh_ttl_days: int = 30

    # Expo dev servers land on whichever of these is free, so allow the usual spread.
    cors_origins: str = (
        "http://localhost:19006,http://localhost:8081,http://localhost:8082,http://localhost:8083"
    )

    s3_endpoint: str = "http://minio:9000"
    s3_region: str = "us-east-1"
    s3_bucket: str = "meal-photos"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    # Use this hostname in presigned URLs when MinIO is private to the API network.
    s3_public_endpoint: str = ""

    openai_api_key: str = ""
    openai_model: str = "gpt-5-mini"
    jev_api_key: str = ""
    jev_model: str = "typesafe-ai/jev"
    daily_ai_image_quota: int = 10

    google_client_id_ios: str = ""
    google_client_id_android: str = ""
    google_client_id_web: str = ""
    apple_client_id: str = ""
    apple_team_id: str = ""
    apple_key_id: str = ""

    expo_access_token: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
