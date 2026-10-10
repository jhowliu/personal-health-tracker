from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from httpx import AsyncClient

MONTH = "2026-09"


async def _log_day(client: AsyncClient, day: str, *, weighed: bool, meals: tuple[str, ...]) -> None:
    if weighed:
        assert (await client.put(f"/body-logs/{day}", json={"weight_kg": 56})).status_code == 200
    for meal in meals:
        response = await client.patch(f"/days/{day}/meals/{meal}", json={"state": "skipped"})
        assert response.status_code == 200


async def test_the_calendar_marks_each_day_of_the_month(with_profile: AsyncClient):
    await _log_day(with_profile, "2026-09-01", weighed=True, meals=("breakfast", "lunch", "dinner"))
    await _log_day(with_profile, "2026-09-02", weighed=True, meals=())
    await _log_day(with_profile, "2026-09-03", weighed=False, meals=("lunch",))

    response = await with_profile.get("/progress/calendar", params={"month": MONTH})
    assert response.status_code == 200
    body = response.json()
    assert body["month"] == MONTH
    days = {day["date"]: day for day in body["days"]}
    assert len(days) == 30
    assert days["2026-09-01"]["mark"] == "complete"
    # Something logged is not enough: a day is complete or it is not.
    assert days["2026-09-02"]["mark"] == "empty"
    assert days["2026-09-03"]["mark"] == "empty"
    assert days["2026-09-04"]["mark"] == "empty"


async def test_the_calendar_says_whether_the_workout_was_done_or_skipped(
    with_profile: AsyncClient,
):
    assert (
        await with_profile.patch("/days/2026-09-08", json={"workout_done": True})
    ).status_code == 200
    assert (
        await with_profile.patch("/days/2026-09-09", json={"workout_skipped": True})
    ).status_code == 200

    days = {
        day["date"]: day
        for day in (await with_profile.get("/progress/calendar", params={"month": MONTH})).json()[
            "days"
        ]
    }
    assert days["2026-09-08"]["workout"] == "done"
    assert days["2026-09-09"]["workout"] == "skipped"
    assert days["2026-09-10"]["workout"] is None


async def test_a_month_is_year_and_month(with_profile: AsyncClient):
    response = await with_profile.get("/progress/calendar", params={"month": "2026-9"})
    assert response.status_code == 422


async def _train(client: AsyncClient, day: str, sets: list[tuple[float | None, int]]) -> None:
    exercise = (
        await client.post("/exercises", json={"category_id": "strength", "name": f"深蹲 {day}"})
    ).json()
    workout = await client.post(
        f"/days/{day}/workout/items",
        json={"exercise_id": exercise["id"], "sets": len(sets), "reps": "5"},
    )
    assert workout.status_code == 201
    item_id = workout.json()["items"][-1]["item"]["id"]
    recorded = await client.put(
        f"/days/{day}/workout/items/{item_id}/sets",
        json={"sets": [{"weight_kg": weight, "reps_done": reps} for weight, reps in sets]},
    )
    assert recorded.status_code == 200


async def test_the_week_sums_its_training_volume_against_the_week_before(
    with_profile: AsyncClient,
):
    await _train(with_profile, "2026-09-15", [(60, 5), (60, 5), (60, 5)])
    # Bodyweight sets have no load, so they add nothing to the kilograms.
    await _train(with_profile, "2026-09-17", [(None, 12), (None, 12)])
    await _train(with_profile, "2026-09-09", [(50, 5), (50, 5)])
    await with_profile.patch("/days/2026-09-15", json={"workout_done": True})
    await with_profile.patch("/days/2026-09-17", json={"workout_done": True})

    response = await with_profile.get("/progress/weekly", params={"week": "2026-09-16"})
    assert response.status_code == 200
    week = response.json()
    assert (week["start"], week["end"]) == ("2026-09-14", "2026-09-20")
    assert week["volume_kg"] == 900
    assert week["previous_volume_kg"] == 500
    assert week["workouts"] == 2


async def test_the_week_compares_average_weight_and_latest_waist(with_profile: AsyncClient):
    for day, weight, waist in (
        ("2026-09-08", 76.0, None),
        ("2026-09-10", 75.6, 89.0),
        ("2026-09-15", 75.4, None),
        ("2026-09-18", 75.2, 88.4),
    ):
        logged = await with_profile.put(
            f"/body-logs/{day}", json={"weight_kg": weight, "waist_cm": waist}
        )
        assert logged.status_code == 200

    week = (await with_profile.get("/progress/weekly", params={"week": "2026-09-14"})).json()
    assert week["weight_average"] == 75.3
    assert week["weight_change"] == -0.5
    assert week["waist_latest"] == 88.4
    assert week["waist_change"] == -0.6


async def test_the_week_counts_its_complete_days(with_profile: AsyncClient):
    await _log_day(with_profile, "2026-09-15", weighed=True, meals=("breakfast", "lunch", "dinner"))
    await _log_day(with_profile, "2026-09-16", weighed=True, meals=())

    week = (await with_profile.get("/progress/weekly", params={"week": "2026-09-14"})).json()
    assert week["days_complete"] == 1
    assert week["weight_change"] is None
    assert week["volume_kg"] == 0


async def test_without_a_date_it_is_the_last_finished_week(with_profile: AsyncClient):
    today = datetime.now(ZoneInfo("Asia/Taipei")).date()
    monday = today - timedelta(days=today.weekday() + 7)

    week = (await with_profile.get("/progress/weekly")).json()
    assert (week["start"], week["end"]) == (str(monday), str(monday + timedelta(days=6)))


async def _finish_day(client: AsyncClient, day: str) -> None:
    await _log_day(client, day, weighed=True, meals=("breakfast", "lunch", "dinner"))
    assert (await client.patch(f"/days/{day}", json={"workout_skipped": True})).status_code == 200


async def test_last_weeks_report_pops_up_once(with_profile: AsyncClient, today):
    today(date(2026, 9, 21))  # a Monday
    await _log_day(with_profile, "2026-09-15", weighed=True, meals=())

    pending = (await with_profile.get("/progress/weekly/pending")).json()
    assert (pending["start"], pending["end"]) == ("2026-09-14", "2026-09-20")

    # Any day of the week marks it.
    seen = await with_profile.post("/progress/weekly/2026-09-16/seen")
    assert seen.status_code == 204
    assert (await with_profile.get("/progress/weekly/pending")).json() is None


async def test_a_week_with_nothing_logged_does_not_pop_up(with_profile: AsyncClient, today):
    today(date(2026, 9, 21))
    # Opening a day is not logging anything.
    assert (await with_profile.get("/days/2026-09-15")).status_code == 200

    assert (await with_profile.get("/progress/weekly/pending")).json() is None


async def test_a_finished_sunday_brings_its_own_week(with_profile: AsyncClient, today):
    today(date(2026, 9, 20))  # a Sunday
    await _log_day(with_profile, "2026-09-09", weighed=True, meals=())
    await _log_day(with_profile, "2026-09-15", weighed=True, meals=())

    # Sunday still under way: the week before is the last one finished.
    pending = (await with_profile.get("/progress/weekly/pending")).json()
    assert pending["start"] == "2026-09-07"

    await _finish_day(with_profile, "2026-09-20")
    pending = (await with_profile.get("/progress/weekly/pending")).json()
    assert pending["start"] == "2026-09-14"
    assert pending["days_complete"] == 1


async def test_past_weeks_list_the_logged_ones_newest_first(with_profile: AsyncClient, today):
    today(date(2026, 9, 20))
    await _finish_day(with_profile, "2026-09-01")
    await with_profile.patch("/days/2026-09-02", json={"workout_done": True})
    await _log_day(with_profile, "2026-09-09", weighed=True, meals=())
    await _log_day(with_profile, "2026-09-15", weighed=True, meals=())

    weeks = (await with_profile.get("/progress/weeks")).json()
    # This week is still going, so it waits until Sunday's flow is done.
    assert [week["start"] for week in weeks] == ["2026-09-07", "2026-08-31"]
    assert (weeks[1]["days_complete"], weeks[1]["workouts"]) == (1, 1)

    await _finish_day(with_profile, "2026-09-20")
    weeks = (await with_profile.get("/progress/weeks")).json()
    assert [week["start"] for week in weeks] == ["2026-09-14", "2026-09-07", "2026-08-31"]


async def test_volume_runs_week_by_week_with_empty_weeks_as_zero(with_profile: AsyncClient, today):
    today(date(2026, 9, 23))  # a Wednesday
    await _train(with_profile, "2026-09-02", [(50, 5), (50, 5)])
    await _train(with_profile, "2026-09-16", [(60, 5)])
    await _train(with_profile, "2026-09-17", [(60, 5), (None, 12)])
    await _train(with_profile, "2026-09-22", [(40, 10)])

    trend = (await with_profile.get("/progress/volume", params={"weeks": 4})).json()
    assert trend["this_week"] == "2026-09-21"
    assert [(week["start"], week["volume_kg"]) for week in trend["weeks"]] == [
        ("2026-08-31", 500),
        ("2026-09-07", 0),
        ("2026-09-14", 600),
        ("2026-09-21", 400),
    ]
