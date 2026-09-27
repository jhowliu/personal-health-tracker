from httpx import AsyncClient

DAY = "2026-09-22"  # Tuesday


async def _workout(client: AsyncClient, *, weight_kg: float | None = 20) -> tuple[dict, dict, dict]:
    original = (
        await client.post("/exercises", json={"category_id": "strength", "name": "原始深蹲"})
    ).json()
    alternative = (
        await client.post("/exercises", json={"category_id": "strength", "name": "替代腿推"})
    ).json()
    template = (
        await client.post(
            "/workout-templates",
            json={
                "category_id": "strength",
                "name": "下肢日",
                "location": "home",
                "items": [
                    {
                        "exercise_id": original["id"],
                        "sets": 3,
                        "reps": "10",
                        "weight_kg": weight_kg,
                    }
                ],
            },
        )
    ).json()
    scheduled = await client.put(
        "/workout-schedule",
        json=[{"weekday": 1, "template_id": template["id"]}],
    )
    assert scheduled.status_code == 200
    return original, alternative, template


async def _day_items(client: AsyncClient) -> list[dict]:
    """The day's own copies of the prescription — not the template's rows."""
    workout = await client.get(f"/days/{DAY}/workout")
    assert workout.status_code == 200
    return [entry["item"] for entry in workout.json()["items"]]


async def _profile(client: AsyncClient) -> None:
    response = await client.put(
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
    assert response.status_code == 200


async def test_daily_swap_is_returned_without_mutating_the_template(with_profile: AsyncClient):
    original, alternative, template = await _workout(with_profile)

    before = await with_profile.get(f"/days/{DAY}/workout")
    assert before.status_code == 200
    assert before.json()["template"]["id"] == template["id"]
    item = before.json()["items"][0]["item"]
    assert item["exercise_id"] == original["id"]
    assert item["replaced_exercise_name"] is None

    replaced = await with_profile.patch(
        f"/days/{DAY}/workout/items/{item['id']}",
        json={"exercise_id": alternative["id"], "replacement_reason": "equipment_occupied"},
    )
    assert replaced.status_code == 200
    assert replaced.json()["items"][0]["item"]["exercise_id"] == alternative["id"]

    swapped = (await _day_items(with_profile))[0]
    assert swapped["exercise_id"] == alternative["id"]
    # The screen can still say what it stood in for, and why.
    assert swapped["replaced_exercise_name"] == "原始深蹲"
    assert swapped["replacement_reason"] == "equipment_occupied"

    stored_template = (await with_profile.get(f"/workout-templates/{template['id']}")).json()
    assert stored_template["items"][0]["exercise_id"] == original["id"]


async def test_replacement_rejects_another_users_day_item(with_profile: AsyncClient):
    _, source_alternative, _template = await _workout(with_profile)
    item_id = (await _day_items(with_profile))[0]["id"]

    registered = await with_profile.post(
        "/auth/register", json={"email": "other@example.com", "password": "supersecret"}
    )
    with_profile.headers["Authorization"] = f"Bearer {registered.json()['access_token']}"
    await _profile(with_profile)
    other_exercise = (
        await with_profile.post(
            "/exercises", json={"category_id": "strength", "name": "別人的動作"}
        )
    ).json()

    rejected = await with_profile.patch(
        f"/days/{DAY}/workout/items/{item_id}",
        json={"exercise_id": other_exercise["id"], "replacement_reason": "variety"},
    )
    assert rejected.status_code == 404

    await _workout(with_profile)
    hidden_exercise = await with_profile.patch(
        f"/days/{DAY}/workout/items/{(await _day_items(with_profile))[0]['id']}",
        json={"exercise_id": source_alternative["id"], "replacement_reason": "variety"},
    )
    assert hidden_exercise.status_code == 404


async def test_day_workout_items_are_crud_snapshots_and_patch_merges_invariants(
    with_profile: AsyncClient,
):
    original, alternative, _template = await _workout(with_profile)
    extra = (
        await with_profile.post("/exercises", json={"category_id": "strength", "name": "替代硬舉"})
    ).json()
    added = await with_profile.post(
        f"/days/{DAY}/workout/items",
        json={"exercise_id": original["id"], "sets": 4, "reps": "8", "weight_kg": 30},
    )
    assert added.status_code == 201
    item = added.json()["items"][-1]["item"]
    assert item["source_item_id"] is None

    edited = await with_profile.patch(
        f"/days/{DAY}/workout/items/{item['id']}", json={"weight_kg": 35}
    )
    assert edited.status_code == 200
    assert edited.json()["items"][-1]["item"]["reps"] == "8"
    assert (await with_profile.patch(
        f"/days/{DAY}/workout/items/{item['id']}", json={"duration_sec": 60}
    )).status_code == 422
    assert (await with_profile.patch(
        f"/days/{DAY}/workout/items/{item['id']}", json={"exercise_id": alternative["id"]}
    )).status_code == 422

    first_swap = await with_profile.patch(
        f"/days/{DAY}/workout/items/{item['id']}",
        json={"exercise_id": alternative["id"], "replacement_reason": "variety"},
    )
    assert first_swap.status_code == 200
    second_swap = await with_profile.patch(
        f"/days/{DAY}/workout/items/{item['id']}",
        json={"exercise_id": extra["id"], "replacement_reason": "equipment_occupied"},
    )
    swapped = next(
        entry["item"]
        for entry in second_swap.json()["items"]
        if entry["item"]["id"] == item["id"]
    )
    assert swapped["replaced_exercise_name"] == "原始深蹲"
    assert (await with_profile.delete(f"/days/{DAY}/workout/items/{item['id']}")).status_code == 204


async def test_set_feedback_returns_a_recommendation_and_workout_logs(with_profile: AsyncClient):
    original, _, _template = await _workout(with_profile)
    item_id = (await _day_items(with_profile))[0]["id"]

    easy = await with_profile.put(
        f"/days/{DAY}/workout/sets",
        json={
            "day_workout_item_id": item_id,
            "exercise_id": original["id"],
            "set_index": 0,
            "reps_done": 10,
            "weight_kg": 20,
            "effort": "easy",
        },
    )
    assert easy.status_code == 200
    assert easy.json()["next_weight_kg"] == 22.5
    assert easy.json()["today"]["date"] == DAY

    appropriate = await with_profile.put(
        f"/days/{DAY}/workout/sets",
        json={
            "day_workout_item_id": item_id,
            "exercise_id": original["id"],
            "set_index": 1,
            "weight_kg": 20,
            "effort": "appropriate",
        },
    )
    hard = await with_profile.put(
        f"/days/{DAY}/workout/sets",
        json={
            "day_workout_item_id": item_id,
            "exercise_id": original["id"],
            "set_index": 2,
            "weight_kg": 1,
            "effort": "hard",
        },
    )
    assert appropriate.json()["next_weight_kg"] == 20
    assert hard.json()["next_weight_kg"] == 0

    workout = (await with_profile.get(f"/days/{DAY}/workout")).json()
    assert workout["items"][0]["completed_set_count"] == 3
    assert workout["items"][0]["logs"][0]["effort"] == "easy"


async def test_template_weight_changes_only_after_explicit_apply(with_profile: AsyncClient):
    _, _, template = await _workout(with_profile, weight_kg=20)
    item_id = template["items"][0]["id"]

    applied = await with_profile.put(
        f"/workout-templates/{template['id']}/items/{item_id}/weight", json={"weight_kg": 22.5}
    )
    assert applied.status_code == 204
    assert (await with_profile.get(f"/workout-templates/{template['id']}")).json()["items"][0][
        "weight_kg"
    ] == 22.5

    wrong_item = await with_profile.put(
        f"/workout-templates/{template['id']}/items/not-a-member/weight", json={"weight_kg": 25}
    )
    assert wrong_item.status_code == 404


async def test_session_burn_is_estimated_only_once_sets_are_logged(with_exercises: AsyncClient):
    await _profile(with_exercises)
    template = (
        await with_exercises.post(
            "/workout-templates",
            json={
                "category_id": "strength",
                "name": "下肢日",
                "location": "home",
                "duration_min": 60,
                "items": [
                    {"exercise_id": "barbell-back-squat", "sets": 3, "reps": "10", "weight_kg": 40}
                ],
            },
        )
    ).json()
    scheduled = await with_exercises.put(
        "/workout-schedule",
        json=[{"weekday": 1, "location": "home", "template_id": template["id"]}],
    )
    assert scheduled.status_code == 200

    planned = await with_exercises.get(f"/days/{DAY}/workout")
    assert planned.status_code == 200
    # Nothing logged yet, so there is nothing honest to estimate from.
    assert planned.json()["estimated_burn_kcal"] is None
    item_id = planned.json()["items"][0]["item"]["id"]

    logged = await with_exercises.put(
        f"/days/{DAY}/workout/sets",
        json={
            "day_workout_item_id": item_id,
            "exercise_id": "barbell-back-squat",
            "set_index": 0,
            "reps_done": 10,
            "weight_kg": 40,
            "effort": "appropriate",
        },
    )
    assert logged.status_code == 200

    # 5.0 MET x 56 kg x 1 hour, the whole plan being this one exercise.
    assert (await with_exercises.get(f"/days/{DAY}/workout")).json()["estimated_burn_kcal"] == 280


async def test_custom_exercises_carry_no_burn_estimate(with_profile: AsyncClient):
    original, _, _template = await _workout(with_profile)
    item_id = (await _day_items(with_profile))[0]["id"]
    await with_profile.put(
        f"/days/{DAY}/workout/sets",
        json={
            "day_workout_item_id": item_id,
            "exercise_id": original["id"],
            "set_index": 0,
            "weight_kg": 20,
            "effort": "appropriate",
        },
    )
    # A user-created exercise has no MET, so the screen gets null rather than a made-up number.
    assert (await with_profile.get(f"/days/{DAY}/workout")).json()["estimated_burn_kcal"] is None


async def test_a_gym_template_still_lands_on_a_day_planned_at_home(with_exercises: AsyncClient):
    await _profile(with_exercises)  # leaves default_location at 'home'
    template = (
        await with_exercises.post(
            "/workout-templates",
            json={
                "category_id": "strength",
                "name": "槓鈴日",
                "items": [{"exercise_id": "barbell-back-squat", "reps": "5"}],
            },
        )
    ).json()
    # Derived from the barbell, not typed in — and no longer a key the schedule matches on.
    assert template["location"] == "gym"

    scheduled = await with_exercises.put(
        "/workout-schedule", json=[{"weekday": 1, "template_id": template["id"]}]
    )
    assert scheduled.status_code == 200
    assert scheduled.json() == [{"weekday": 1, "template_id": template["id"]}]

    workout = (await with_exercises.get(f"/days/{DAY}/workout")).json()
    assert workout["template"]["id"] == template["id"]


async def test_a_bodyweight_template_reads_as_home(with_exercises: AsyncClient):
    await _profile(with_exercises)
    template = (
        await with_exercises.post(
            "/workout-templates",
            json={
                "category_id": "strength",
                "name": "徒手日",
                "items": [
                    {"exercise_id": "push-up", "reps": "10"},
                    {"exercise_id": "bodyweight-squat", "reps": "15"},
                ],
            },
        )
    ).json()
    assert template["location"] == "home"


async def test_dumbbell_work_counts_as_doable_at_home(with_exercises: AsyncClient):
    await _profile(with_exercises)
    template = (
        await with_exercises.post(
            "/workout-templates",
            json={
                "category_id": "strength",
                "name": "啞鈴日",
                "items": [{"exercise_id": "dumbbell-goblet-squat", "reps": "10"}],
            },
        )
    ).json()
    # Dumbbells are seeded as 'both'; only a gym-only exercise forces the whole session out.
    assert template["location"] == "home"


async def _timed_template(client: AsyncClient, items: list[dict], duration_min: int) -> dict:
    template = (
        await client.post(
            "/workout-templates",
            json={
                "category_id": "cardio",
                "name": "球場日",
                "duration_min": duration_min,
                "items": items,
            },
        )
    ).json()
    scheduled = await client.put(
        "/workout-schedule", json=[{"weekday": 1, "template_id": template["id"]}]
    )
    assert scheduled.status_code == 200
    return template


async def test_a_timed_item_needs_no_reps(with_exercises: AsyncClient):
    await _profile(with_exercises)
    template = await _timed_template(
        with_exercises, [{"exercise_id": "tennis-singles", "duration_sec": 5400}], 90
    )
    assert template["items"][0]["reps"] is None
    assert template["items"][0]["duration_sec"] == 5400


async def test_an_item_with_neither_reps_nor_duration_is_rejected(with_exercises: AsyncClient):
    await _profile(with_exercises)
    rejected = await with_exercises.post(
        "/workout-templates",
        json={"category_id": "cardio", "name": "空的", "items": [{"exercise_id": "badminton"}]},
    )
    assert rejected.status_code == 422


async def test_long_and_short_items_are_costed_separately(with_exercises: AsyncClient):
    await _profile(with_exercises)
    await _timed_template(
        with_exercises,
        [
            {"exercise_id": "tennis-singles", "duration_sec": 5400},
            {"exercise_id": "cat-cow", "duration_sec": 600},
        ],
        100,
    )
    for item in await _day_items(with_exercises):
        logged = await with_exercises.put(
            f"/days/{DAY}/workout/sets",
            json={
                "day_workout_item_id": item["id"],
                "exercise_id": item["exercise_id"],
                "set_index": 0,
                "effort": "appropriate",
            },
        )
        assert logged.status_code == 200

    # 7.3 x 56 x 1.5h + 2.3 x 56 x (10/60)h. Averaging the two METs over the whole 100
    # minutes, as the old session-level estimate did, would read ~450 instead.
    assert (await with_exercises.get(f"/days/{DAY}/workout")).json()["estimated_burn_kcal"] == 635


async def test_a_logged_duration_beats_the_prescribed_one(with_exercises: AsyncClient):
    await _profile(with_exercises)
    await _timed_template(
        with_exercises, [{"exercise_id": "tennis-singles", "duration_sec": 5400}], 90
    )
    item_id = (await _day_items(with_exercises))[0]["id"]
    logged = await with_exercises.put(
        f"/days/{DAY}/workout/sets",
        json={
            "day_workout_item_id": item_id,
            "exercise_id": "tennis-singles",
            "set_index": 0,
            "duration_sec": 2400,
            "effort": "appropriate",
        },
    )
    assert logged.status_code == 200
    # Planned 90 minutes, played 40: 7.3 x 56 x (40/60)h.
    assert (await with_exercises.get(f"/days/{DAY}/workout")).json()["estimated_burn_kcal"] == 273


async def test_editing_the_template_leaves_a_day_already_underway_alone(
    with_profile: AsyncClient,
):
    original, _, template = await _workout(with_profile)
    item_id = (await _day_items(with_profile))[0]["id"]
    logged = await with_profile.put(
        f"/days/{DAY}/workout/sets",
        json={
            "day_workout_item_id": item_id,
            "exercise_id": original["id"],
            "set_index": 0,
            "reps_done": 10,
            "weight_kg": 20,
            "effort": "appropriate",
        },
    )
    assert logged.status_code == 200

    edited = await with_profile.put(
        f"/workout-templates/{template['id']}",
        json={
            "category_id": "strength",
            "name": "下肢日(改過)",
            "items": [{"exercise_id": original["id"], "sets": 5, "reps": "5", "weight_kg": 60}],
        },
    )
    assert edited.status_code == 200

    # Re-saving a template used to delete every item row, which nulled the logs' link and
    # made a finished set vanish from the screen. The day owns its own copy now.
    entry = (await with_profile.get(f"/days/{DAY}/workout")).json()["items"][0]
    assert entry["completed_set_count"] == 1
    assert entry["item"]["sets"] == 3
    assert entry["item"]["weight_kg"] == 20
