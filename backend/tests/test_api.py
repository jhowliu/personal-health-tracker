from httpx import AsyncClient

TODAY = "2026-09-22"


async def test_healthz(api: AsyncClient):
    assert (await api.get("/healthz")).json() == {"status": "ok"}


async def test_register_rejects_a_duplicate_email(api: AsyncClient):
    body = {"email": "her@example.com", "password": "supersecret"}
    assert (await api.post("/auth/register", json=body)).status_code == 201
    assert (await api.post("/auth/register", json=body)).status_code == 409


async def test_login_and_refresh_round_trip(api: AsyncClient):
    body = {"email": "her@example.com", "password": "supersecret"}
    await api.post("/auth/register", json=body)

    login = await api.post("/auth/login", json=body)
    assert login.status_code == 200

    refreshed = await api.post(
        "/auth/refresh", json={"refresh_token": login.json()["refresh_token"]}
    )
    assert refreshed.status_code == 200

    reused = await api.post(
        "/auth/refresh", json={"refresh_token": login.json()["refresh_token"]}
    )
    assert reused.status_code == 401, "refresh token 只能用一次"


async def test_wrong_password_is_rejected(api: AsyncClient):
    await api.post(
        "/auth/register", json={"email": "her@example.com", "password": "supersecret"}
    )
    response = await api.post(
        "/auth/login", json={"email": "her@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401


async def test_protected_route_needs_a_token(api: AsyncClient):
    assert (await api.get("/users/me/profile")).status_code == 401


async def test_targets_match_the_spec_example(with_profile: AsyncClient):
    targets = (await with_profile.get("/users/me/profile")).json()["targets"]

    assert targets["bmr"] == 1269
    assert targets["tdee"] == 1523
    assert targets["kcal"] == 1340
    assert targets["protein_g"] == 101
    assert targets["fat_g"] == 45
    assert targets["carb_g"] == 133


async def test_targets_recalculate_after_editing_the_profile(with_profile: AsyncClient):
    before = (await with_profile.get("/users/me/profile")).json()["targets"]["kcal"]
    response = await with_profile.patch("/users/me/profile", json={"deficit_pct": 20})

    assert response.status_code == 200
    assert response.json()["targets"]["kcal"] < before


async def test_target_preview_does_not_save(signed_in: AsyncClient):
    preview = await signed_in.post(
        "/users/me/targets/preview",
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

    assert preview.json()["kcal"] == 1340
    assert (await signed_in.get("/users/me/profile")).status_code == 404


async def test_profile_is_required_before_targets(signed_in: AsyncClient):
    assert (await signed_in.get("/users/me/profile")).status_code == 404


async def test_body_log_round_trip(with_profile: AsyncClient):
    saved = await with_profile.put(
        f"/body-logs/{TODAY}", json={"weight_kg": 56.1, "waist_cm": 72.0}
    )
    assert saved.status_code == 200

    history = (await with_profile.get(f"/body-logs?from_=2026-09-01&to={TODAY}")).json()
    assert history == [{"date": TODAY, "weight_kg": 56.1, "waist_cm": 72.0}]

    assert (await with_profile.delete(f"/body-logs/{TODAY}")).status_code == 204
    assert (await with_profile.get(f"/body-logs?from_=2026-09-01&to={TODAY}")).json() == []


async def test_body_log_needs_at_least_one_measurement(with_profile: AsyncClient):
    response = await with_profile.put(f"/body-logs/{TODAY}", json={})
    assert response.status_code == 422


async def test_body_summary_reports_week_over_week(with_profile: AsyncClient):
    for day, weight in [("2026-09-15", 56.6), ("2026-09-16", 56.6), ("2026-09-22", 56.2)]:
        await with_profile.put(f"/body-logs/{day}", json={"weight_kg": weight})

    summary = (await with_profile.get(f"/body-logs/summary?from_=2026-09-01&to={TODAY}")).json()
    assert summary["week_avg_weight"] == 56.2
    assert summary["week_avg_delta"] == -0.4
    assert len(summary["weight_series"]) == 3


async def test_new_day_starts_at_the_weigh_in_step(with_profile: AsyncClient):
    day = (await with_profile.get(f"/days/{TODAY}")).json()

    assert day["flow"]["current"] == "body"
    # The workout step is always there; on a rest day it is simply never the one waited on.
    assert day["flow"]["steps"] == ["body", "breakfast", "lunch", "workout", "dinner"]
    assert day["streak"] == 0
    assert day["targets"]["kcal"] == 1340


async def test_workout_time_moves_the_workout_step(with_profile: AsyncClient):
    """What the settings screen relies on: the profile sets days still to come, and an
    already opened day moves only when it is changed itself."""
    evening = ["body", "breakfast", "lunch", "workout", "dinner"]
    morning = ["body", "breakfast", "workout", "lunch", "dinner"]
    assert (await with_profile.get(f"/days/{TODAY}")).json()["flow"]["steps"] == evening

    patched = await with_profile.patch("/users/me/profile", json={"workout_time": "am"})
    assert patched.status_code == 200
    assert patched.json()["profile"]["workout_time"] == "am"
    # Opened before the change, today keeps the time it copied...
    assert (await with_profile.get(f"/days/{TODAY}")).json()["flow"]["steps"] == evening
    # ...until it is moved too.
    moved = await with_profile.patch(f"/days/{TODAY}", json={"workout_time": "am"})
    assert moved.json()["flow"]["steps"] == morning
    # A day opened afterwards starts from the profile.
    assert (await with_profile.get("/days/2026-09-23")).json()["flow"]["steps"] == morning


async def test_flow_advances_as_the_day_is_logged(with_profile: AsyncClient):
    await with_profile.get(f"/days/{TODAY}")
    await with_profile.put(f"/body-logs/{TODAY}", json={"weight_kg": 56.1})

    after_weigh_in = (await with_profile.get(f"/days/{TODAY}")).json()
    assert after_weigh_in["flow"]["current"] == "breakfast"

    after_breakfast = (await with_profile.patch(f"/days/{TODAY}/meals/breakfast")).json()
    assert after_breakfast["flow"]["current"] == "lunch"
    assert after_breakfast["flow"]["completed"] == ["body", "breakfast"]


async def test_streak_counts_a_fully_logged_day(with_profile: AsyncClient):
    await with_profile.get(f"/days/{TODAY}")
    await with_profile.put(f"/body-logs/{TODAY}", json={"weight_kg": 56.1})
    for meal in ("breakfast", "lunch", "dinner"):
        await with_profile.patch(f"/days/{TODAY}/meals/{meal}")

    day = (await with_profile.get(f"/days/{TODAY}")).json()
    assert day["flow"]["current"] == "done"
    assert day["streak"] == 1


async def test_the_streak_survives_the_morning_before_today_is_logged(
    with_profile: AsyncClient,
):
    for day in ("2026-09-20", "2026-09-21"):
        await with_profile.get(f"/days/{day}")
        await with_profile.put(f"/body-logs/{day}", json={"weight_kg": 56.1})
        for meal in ("breakfast", "lunch", "dinner"):
            await with_profile.patch(f"/days/{day}/meals/{meal}")

    morning = (await with_profile.get(f"/days/{TODAY}")).json()
    assert morning["flow"]["current"] == "body"
    assert morning["streak"] == 2

    await with_profile.put(f"/body-logs/{TODAY}", json={"weight_kg": 56.0})
    for meal in ("breakfast", "lunch", "dinner"):
        await with_profile.patch(f"/days/{TODAY}/meals/{meal}")
    assert (await with_profile.get(f"/days/{TODAY}")).json()["streak"] == 3


async def test_meal_states_complete_flow_and_skips_count_toward_streak(with_profile: AsyncClient):
    await with_profile.get(f"/days/{TODAY}")
    await with_profile.put(f"/body-logs/{TODAY}", json={"weight_kg": 56.1})

    skipped = await with_profile.patch(f"/days/{TODAY}/meals/breakfast", json={"state": "skipped"})
    assert skipped.status_code == 200
    assert skipped.json()["flow"]["current"] == "lunch"
    assert skipped.json()["flow"]["eaten"]["kcal"] == 0

    planned = await with_profile.patch(f"/days/{TODAY}/meals/breakfast", json={"state": "planned"})
    assert planned.json()["flow"]["current"] == "breakfast"

    for meal in ("breakfast", "lunch", "dinner"):
        await with_profile.patch(f"/days/{TODAY}/meals/{meal}", json={"state": "skipped"})
    completed = await with_profile.get(f"/days/{TODAY}")
    assert completed.json()["flow"]["current"] == "done"
    assert completed.json()["streak"] == 1
    assert (await with_profile.patch(f"/days/{TODAY}/meals/extras")).status_code == 422


async def test_skipping_a_workout_completes_only_that_step(with_profile: AsyncClient):
    exercise = (
        await with_profile.post("/exercises", json={"category_id": "strength", "name": "深蹲"})
    ).json()
    template = (
        await with_profile.post(
            "/workout-templates",
            json={
                "category_id": "strength",
                "name": "下肢",
                "items": [{"exercise_id": exercise["id"], "reps": "10"}],
            },
        )
    ).json()
    await with_profile.put(
        "/workout-schedule", json=[{"weekday": 1, "template_id": template["id"]}]
    )

    skipped = await with_profile.patch(f"/days/{TODAY}", json={"workout_skipped": True})
    assert "workout" in skipped.json()["flow"]["completed"]
    unchanged = await with_profile.patch(f"/days/{TODAY}", json={"workout_skipped": False})
    assert "workout" in unchanged.json()["flow"]["completed"]


async def test_workout_template_lifecycle(with_profile: AsyncClient):
    exercise = (
        await with_profile.post(
            "/exercises",
            json={
                "category_id": "strength",
                "name": "腿推機 Leg Press",
                "equipment": "machine",
                "location": "gym",
            },
        )
    ).json()

    created = await with_profile.post(
        "/workout-templates",
        json={
            "category_id": "strength",
            "name": "健身房:下肢",
            "duration_min": 55,
            "items": [
                {"exercise_id": exercise["id"], "sets": 3, "reps": "10-12", "weight_kg": 40}
            ],
        },
    )
    assert created.status_code == 201
    template = created.json()
    assert template["items"][0]["exercise_name"] == "腿推機 Leg Press"
    # Location comes from what the exercises say about themselves, not from the form.
    assert template["location"] == "gym"

    listed = (await with_profile.get("/workout-templates?location=gym")).json()
    assert [t["id"] for t in listed] == [template["id"]]

    assert (
        await with_profile.delete(f"/workout-templates/{template['id']}")
    ).status_code == 204
    assert (await with_profile.get("/workout-templates")).json() == []



async def test_scheduled_workout_adds_a_step_to_the_day(with_profile: AsyncClient):
    exercise = (
        await with_profile.post("/exercises", json={"category_id": "strength", "name": "深蹲"})
    ).json()
    template = (
        await with_profile.post(
            "/workout-templates",
            json={
                "category_id": "strength",
                "name": "在家:下肢",
                "location": "home",
                "items": [{"exercise_id": exercise["id"], "reps": "12"}],
            },
        )
    ).json()

    # 2026-09-22 is a Tuesday -> weekday 1
    await with_profile.put(
        "/workout-schedule",
        json=[{"weekday": 1, "location": "home", "template_id": template["id"]}],
    )

    day = (await with_profile.get(f"/days/{TODAY}")).json()
    assert day["flow"]["steps"] == ["body", "breakfast", "lunch", "workout", "dinner"]


async def test_schedule_set_after_the_day_started_still_adds_the_workout_step(
    with_profile: AsyncClient,
):
    """The day is opened first, the schedule set afterwards — today's flow must still
    wait on the workout step.
    """
    await with_profile.get(f"/days/{TODAY}")
    await with_profile.put(f"/body-logs/{TODAY}", json={"weight_kg": 56.1})
    await with_profile.patch(f"/days/{TODAY}/meals/breakfast")
    before = (await with_profile.patch(f"/days/{TODAY}/meals/lunch")).json()
    assert before["flow"]["current"] == "dinner"

    exercise = (
        await with_profile.post("/exercises", json={"category_id": "strength", "name": "深蹲"})
    ).json()
    template = (
        await with_profile.post(
            "/workout-templates",
            json={
                "category_id": "strength",
                "name": "在家:下肢",
                "location": "home",
                "items": [{"exercise_id": exercise["id"], "reps": "12"}],
            },
        )
    ).json()
    await with_profile.put(
        "/workout-schedule",
        json=[{"weekday": 1, "location": "home", "template_id": template["id"]}],
    )

    after = (await with_profile.get(f"/days/{TODAY}")).json()
    assert after["flow"]["current"] == "workout"


async def test_deleting_the_account_removes_everything(with_profile: AsyncClient):
    await with_profile.put(f"/body-logs/{TODAY}", json={"weight_kg": 56.1})
    assert (await with_profile.delete("/users/me")).status_code == 204
    assert (await with_profile.get("/users/me/profile")).status_code == 404
