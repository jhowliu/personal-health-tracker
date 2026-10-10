from httpx import AsyncClient

import app.api.deps as deps
from tests.test_p3 import FakeStorage


async def test_consent_is_off_until_given_and_can_be_withdrawn(signed_in: AsyncClient):
    assert (await signed_in.get("/users/me/ai-consent")).json() == {"consent": False}

    given = await signed_in.put("/users/me/ai-consent", json={"consent": True})
    assert given.json() == {"consent": True}
    assert (await signed_in.get("/users/me/ai-consent")).json() == {"consent": True}

    await signed_in.put("/users/me/ai-consent", json={"consent": False})
    assert (await signed_in.get("/users/me/ai-consent")).json() == {"consent": False}


async def test_a_photo_is_not_sent_to_the_ai_without_consent(signed_in: AsyncClient, monkeypatch):
    monkeypatch.setattr(deps, "object_storage", lambda: FakeStorage())
    photo = (await signed_in.post("/meal-photos", json={"content_type": "image/jpeg"})).json()

    refused = await signed_in.post(f"/meal-photos/{photo['id']}/analyze")
    assert refused.status_code == 428

    await signed_in.put("/users/me/ai-consent", json={"consent": True})
    # Past the consent check; with no AI key set in tests the recognizer itself declines.
    assert (await signed_in.post(f"/meal-photos/{photo['id']}/analyze")).status_code == 503
