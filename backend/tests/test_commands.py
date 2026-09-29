from httpx import AsyncClient

from app.application.commands import UNSET, ProfileChange, applied
from app.domain.models import Sex


def test_only_the_fields_that_were_given_are_applied():
    assert applied(ProfileChange()) == {}
    assert applied(ProfileChange(sex=Sex.MALE, reminder_time=None)) == {
        "sex": Sex.MALE,
        "reminder_time": None,
    }
    assert ProfileChange().weight_kg is UNSET


async def test_a_reminder_time_can_be_set_and_then_cleared(with_profile: AsyncClient):
    set_ = await with_profile.patch("/users/me/reminders", json={"reminder_time": "07:30"})
    assert set_.status_code == 200
    assert set_.json()["reminder_time"] == "07:30"

    cleared = await with_profile.patch("/users/me/reminders", json={"reminder_time": None})
    assert cleared.status_code == 200
    assert cleared.json()["reminder_time"] is None


async def test_leaving_a_reminder_field_out_keeps_it(with_profile: AsyncClient):
    await with_profile.patch("/users/me/reminders", json={"reminder_time": "07:30"})

    kept = await with_profile.patch("/users/me/reminders", json={"timezone": "Asia/Tokyo"})

    assert kept.json()["reminder_time"] == "07:30"
    assert kept.json()["timezone"] == "Asia/Tokyo"


async def test_a_null_for_a_required_profile_field_is_ignored(with_profile: AsyncClient):
    before = (await with_profile.get("/users/me/profile")).json()["profile"]

    patched = await with_profile.patch(
        "/users/me/profile", json={"sex": None, "weight_kg": 55}
    )

    assert patched.status_code == 200
    assert patched.json()["profile"]["sex"] == before["sex"]
    assert patched.json()["profile"]["weight_kg"] == 55


async def test_a_day_adjustment_marks_the_workout_and_rejects_both_marks(
    with_profile: AsyncClient,
):
    done = await with_profile.patch("/days/2026-09-22", json={"workout_done": True})
    assert done.status_code == 200

    both = await with_profile.patch(
        "/days/2026-09-22", json={"workout_done": True, "workout_skipped": True}
    )
    assert both.status_code == 422
