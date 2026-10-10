from datetime import date

from httpx import AsyncClient

import app.api.deps as deps
from app.adapters.ai.weekly_advice import render
from app.domain.weekly_advice import WeekDigest, WeeklyAdvice
from tests.test_progress import _log_day, _train


class FakeAdvisor:
    def __init__(self) -> None:
        self.weeks: list[WeekDigest] = []

    async def advise(self, week: WeekDigest) -> WeeklyAdvice:
        self.weeks.append(week)
        return WeeklyAdvice(
            summary="記了 3 天", diet="早餐加一份蛋", training="週三補練腿", body="體重穩定下降"
        )


def _advisor(monkeypatch) -> FakeAdvisor:
    advisor = FakeAdvisor()
    monkeypatch.setattr(deps, "weekly_advisor", lambda: advisor)
    return advisor


async def test_no_advice_without_consent(with_profile: AsyncClient, today, monkeypatch):
    today(date(2026, 9, 21))
    advisor = _advisor(monkeypatch)
    await _log_day(with_profile, "2026-09-15", weighed=True, meals=())

    refused = await with_profile.post("/progress/weekly/2026-09-14/advice")
    assert refused.status_code == 428
    assert advisor.weeks == []


async def test_a_weeks_advice_is_written_once_and_kept(
    with_profile: AsyncClient, today, monkeypatch
):
    today(date(2026, 9, 21))
    advisor = _advisor(monkeypatch)
    await with_profile.put("/users/me/ai-consent", json={"consent": True})
    await _log_day(with_profile, "2026-09-15", weighed=True, meals=("breakfast",))
    await _train(with_profile, "2026-09-16", [(60, 5), (60, 5)])
    await with_profile.patch("/days/2026-09-16", json={"workout_done": True})

    first = await with_profile.post("/progress/weekly/2026-09-17/advice")
    assert first.status_code == 200
    assert first.json() == {
        "summary": "記了 3 天",
        "diet": "早餐加一份蛋",
        "training": "週三補練腿",
        "body": "體重穩定下降",
    }
    again = await with_profile.post("/progress/weekly/2026-09-14/advice")
    assert again.json() == first.json()
    assert len(advisor.weeks) == 1

    week = advisor.weeks[0]
    assert week.review.start == date(2026, 9, 14)
    tuesday, wednesday, thursday = week.days[1], week.days[2], week.days[3]
    assert tuesday.weight_kg == 56
    assert tuesday.targets is not None
    assert [(meal.meal_time.value, meal.state) for meal in tuesday.meals][:3] == [
        ("breakfast", "skipped"),
        ("lunch", "open"),
        ("dinner", "open"),
    ]
    assert wednesday.workout.value == "done"
    assert [(e.sets, e.reps, e.top_weight_kg) for e in wednesday.exercises] == [(2, 10, 60)]
    # A day never opened stays unopened, and reads as nothing logged.
    assert thursday.targets is None
    text = render(week)
    assert "2026-09-16 Wed" in text and "workout done" in text
    assert "2026-09-18 Fri\n  nothing logged" in text


async def test_a_week_still_under_way_gets_no_advice(with_profile: AsyncClient, today, monkeypatch):
    today(date(2026, 9, 19))  # Saturday
    _advisor(monkeypatch)
    await with_profile.put("/users/me/ai-consent", json={"consent": True})
    await _log_day(with_profile, "2026-09-15", weighed=True, meals=())

    assert (await with_profile.post("/progress/weekly/2026-09-14/advice")).status_code == 422


async def test_a_week_with_nothing_logged_has_no_advice(
    with_profile: AsyncClient, today, monkeypatch
):
    today(date(2026, 9, 21))
    advisor = _advisor(monkeypatch)
    await with_profile.put("/users/me/ai-consent", json={"consent": True})

    response = await with_profile.post("/progress/weekly/2026-09-14/advice")
    assert response.status_code == 200
    assert response.json() is None
    assert advisor.weeks == []
