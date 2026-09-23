from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app
from scripts.migrate import apply


@pytest.fixture
async def api(tmp_path, monkeypatch) -> AsyncIterator[AsyncClient]:
    db_path = str(tmp_path / "test.sqlite")
    monkeypatch.setattr(settings, "db_path", db_path)
    apply(db_path)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def signed_in(api: AsyncClient) -> AsyncClient:
    response = await api.post(
        "/auth/register", json={"email": "her@example.com", "password": "supersecret"}
    )
    assert response.status_code == 201, response.text
    api.headers["Authorization"] = f"Bearer {response.json()['access_token']}"
    return api


@pytest.fixture
async def with_profile(signed_in: AsyncClient) -> AsyncClient:
    response = await signed_in.put(
        "/users/me/profile",
        json={
            "sex": "f",
            "birth_date": "1995-01-01",
            "height_cm": 164,
            "weight_kg": 56,
            "activity_level": "sedentary",
            "deficit_pct": 12,
            "timezone": "Asia/Taipei",
        },
    )
    assert response.status_code == 200, response.text
    return signed_in
