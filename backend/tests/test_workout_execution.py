from datetime import datetime
from zoneinfo import ZoneInfo

from httpx import AsyncClient

from seeds.exercises import seed as seed_exercises
from seeds.workout_templates import seed as seed_workout_templates

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


async def test_removing_every_scheduled_item_does_not_recreate_the_day(
    with_profile: AsyncClient,
):
    _, _, template = await _workout(with_profile)
    first = await _day_items(with_profile)
    assert len(first) == 1
    removed = await with_profile.delete(f"/days/{DAY}/workout/items/{first[0]['id']}")
    assert removed.status_code == 204

    again = await with_profile.get(f"/days/{DAY}/workout")
    assert again.status_code == 200
    assert again.json()["template"]["id"] == template["id"]
    assert again.json()["items"] == []
    assert (await _day_items(with_profile)) == []


async def test_a_days_workout_can_be_taken_off_for_that_day_only(with_profile: AsyncClient):
    _, _, template = await _workout(with_profile)
    assert len(await _day_items(with_profile)) == 1

    cleared = await with_profile.delete(f"/days/{DAY}/workout")
    assert cleared.status_code == 204

    # Opening the day again does not bring the scheduled template back.
    workout = (await with_profile.get(f"/days/{DAY}/workout")).json()
    assert (workout["template"], workout["items"]) == (None, [])
    # A rest day now: the flow no longer waits on the workout.
    day = (await with_profile.get(f"/days/{DAY}")).json()
    assert "workout" not in day["flow"]["waiting"]
    # The schedule and the template itself are untouched.
    schedule = (await with_profile.get("/workout-schedule")).json()
    assert [entry["template_id"] for entry in schedule] == [template["id"]]
    assert (await with_profile.get(f"/workout-templates/{template['id']}")).status_code == 200


async def test_a_workout_with_a_logged_set_is_not_taken_off(with_profile: AsyncClient):
    original, _, _template = await _workout(with_profile)
    item_id = (await _day_items(with_profile))[0]["id"]
    await with_profile.put(
        f"/days/{DAY}/workout/sets",
        json={
            "day_workout_item_id": item_id,
            "exercise_id": original["id"],
            "set_index": 0,
            "reps_done": 10,
        },
    )

    refused = await with_profile.delete(f"/days/{DAY}/workout")
    assert refused.status_code == 422
    assert len(await _day_items(with_profile)) == 1


async def test_day_can_be_saved_as_an_owned_template_without_modifying_public_source(
    with_profile: AsyncClient,
):
    await seed_exercises()
    await seed_workout_templates()
    await with_profile.put(
        "/workout-schedule", json=[{"weekday": 1, "template_id": "beginner-full-body-a"}]
    )
    day = (await with_profile.get(f"/days/{DAY}/workout")).json()
    first = day["items"][0]["item"]
    updated = await with_profile.patch(
        f"/days/{DAY}/workout/items/{first['id']}", json={"weight_kg": 30}
    )
    assert updated.status_code == 200

    saved = await with_profile.post(
        f"/days/{DAY}/workout/save-as-template", json={"name": "我的全身訓練"}
    )
    assert saved.status_code == 201
    assert saved.json()["is_builtin"] is False
    assert saved.json()["id"] != day["template"]["id"]
    assert saved.json()["items"][0]["weight_kg"] == 30
    assert [item["exercise_id"] for item in saved.json()["items"]] == [
        entry["item"]["exercise_id"] for entry in day["items"]
    ]
    assert (await with_profile.get("/workout-templates/beginner-full-body-a")).json()["items"][0][
        "weight_kg"
    ] is None
    assert (await with_profile.get("/workout-schedule")).json() == [
        {"weekday": 1, "template_id": "beginner-full-body-a"}
    ]


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


async def test_an_exercises_record_is_replaced_whole(with_profile: AsyncClient):
    original, _, _template = await _workout(with_profile)
    item_id = (await _day_items(with_profile))[0]["id"]
    path = f"/days/{DAY}/workout/items/{item_id}/sets"

    written = await with_profile.put(
        path,
        json={
            "sets": [
                {"reps_done": 12, "weight_kg": 20},
                {"reps_done": 10, "weight_kg": 22.5},
                {"reps_done": 8, "weight_kg": 22.5, "effort": "easy"},
            ]
        },
    )
    assert written.status_code == 200
    # The last set's weight and effort say where the next session starts.
    assert written.json()["next_weight_kg"] == 25
    logs = (await with_profile.get(f"/days/{DAY}/workout")).json()["items"][0]["logs"]
    assert [(log["set_index"], log["reps_done"], log["weight_kg"]) for log in logs] == [
        (0, 12, 20),
        (1, 10, 22.5),
        (2, 8, 22.5),
    ]
    assert {log["exercise_id"] for log in logs} == {original["id"]}

    # A set left out is gone, not kept from before.
    shorter = await with_profile.put(path, json={"sets": [{"reps_done": 12, "weight_kg": 20}]})
    assert shorter.json()["next_weight_kg"] is None
    entry = (await with_profile.get(f"/days/{DAY}/workout")).json()["items"][0]
    assert [log["reps_done"] for log in entry["logs"]] == [12]
    assert entry["completed_set_count"] == 1

    cleared = await with_profile.put(path, json={"sets": []})
    assert cleared.status_code == 200
    assert (await with_profile.get(f"/days/{DAY}/workout")).json()["items"][0]["logs"] == []


async def test_a_record_needs_what_the_exercise_is_measured_in(with_exercises: AsyncClient):
    await _profile(with_exercises)
    workout = await with_exercises.post(
        f"/days/{DAY}/workout/items",
        json={"exercise_id": "barbell-back-squat", "sets": 3, "reps": "10"},
    )
    item_id = workout.json()["items"][0]["item"]["id"]

    missing_reps = await with_exercises.put(
        f"/days/{DAY}/workout/items/{item_id}/sets", json={"sets": [{"weight_kg": 40}]}
    )
    assert missing_reps.status_code == 422


async def test_a_record_for_an_item_not_on_the_day_is_not_found(with_profile: AsyncClient):
    await _workout(with_profile)
    response = await with_profile.put(
        f"/days/{DAY}/workout/items/no-such-item/sets", json={"sets": [{"reps_done": 10}]}
    )
    assert response.status_code == 404


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

    # No clock yet, so the set is costed at 10 reps x 3 s + 60 s rest:
    # (5.0 - 1) MET x 56 kg x 90 s. The resting MET is already in the day's base target.
    assert (await with_exercises.get(f"/days/{DAY}/workout")).json()["estimated_burn_kcal"] == 6

    # Focus mode clocked the hour: that is the time the set took, rests and all.
    await with_exercises.patch(f"/days/{DAY}", json={"workout_done": True, "trained_sec": 3600})
    assert (await with_exercises.get(f"/days/{DAY}/workout")).json()["estimated_burn_kcal"] == 224


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

    # 6.3 x 56 x 1.5h + 1.3 x 56 x (10/60)h, net of the resting MET. Averaging the two METs
    # over the whole 100 minutes would read far lower.
    assert (await with_exercises.get(f"/days/{DAY}/workout")).json()["estimated_burn_kcal"] == 541


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
    # Planned 90 minutes, played 40: (7.3 - 1) x 56 x (40/60)h.
    assert (await with_exercises.get(f"/days/{DAY}/workout")).json()["estimated_burn_kcal"] == 235


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


async def test_adding_to_a_scheduled_day_keeps_the_scheduled_prescription(
    with_profile: AsyncClient,
):
    original, alternative, _template = await _workout(with_profile)

    # The very first call on the day is the add, so the day has not been opened yet.
    added = await with_profile.post(
        f"/days/{DAY}/workout/items",
        json={"exercise_id": alternative["id"], "sets": 2, "reps": "12"},
    )

    assert added.status_code == 201
    exercises = [entry["item"]["exercise_id"] for entry in added.json()["items"]]
    assert exercises == [original["id"], alternative["id"]]


async def test_an_item_can_switch_from_reps_to_a_duration_by_clearing_reps(
    with_profile: AsyncClient,
):
    await _workout(with_profile)
    item = (await _day_items(with_profile))[0]
    assert item["reps"] == "10"

    switched = await with_profile.patch(
        f"/days/{DAY}/workout/items/{item['id']}", json={"reps": None, "duration_sec": 60}
    )

    assert switched.status_code == 200
    edited = switched.json()["items"][0]["item"]
    assert edited["reps"] is None
    assert edited["duration_sec"] == 60
    assert edited["sets"] == 3, "fields that were not sent stay as they were"


async def _log_set(
    client: AsyncClient, day: str, exercise_id: str, set_index: int, weight_kg: float,
    reps: int, effort: str | None = None,
) -> None:
    workout = (await client.get(f"/days/{day}/workout")).json()
    logged = await client.put(
        f"/days/{day}/workout/sets",
        json={
            "day_workout_item_id": workout["items"][0]["item"]["id"],
            "exercise_id": exercise_id,
            "set_index": set_index,
            "reps_done": reps,
            "weight_kg": weight_kg,
            "effort": effort,
        },
    )
    assert logged.status_code == 200


async def test_each_exercise_carries_its_last_set_and_best_weight_from_earlier_days(
    with_profile: AsyncClient,
):
    """Focus mode starts each exercise from the last set done and marks a new best."""
    original, _, _ = await _workout(with_profile)
    await _log_set(with_profile, "2026-09-08", original["id"], 0, 50, 8)
    await _log_set(with_profile, "2026-09-08", original["id"], 1, 52.5, 6)
    await _log_set(with_profile, "2026-09-15", original["id"], 0, 45, 12)
    await _log_set(with_profile, "2026-09-15", original["id"], 1, 47.5, 10, "easy")
    # A later day is not "earlier", even when it is already logged.
    await _log_set(with_profile, "2026-09-29", original["id"], 0, 100, 5)

    entry = (await with_profile.get(f"/days/{DAY}/workout")).json()["items"][0]

    assert entry["last_set"] == {
        "date": "2026-09-15",
        "weight_kg": 47.5,
        "reps_done": 10,
        "duration_sec": None,
        "effort": "easy",
        "speed_kmh": None,
        "incline_pct": None,
    }
    assert entry["best_weight_kg"] == 52.5
    # It felt easy last time, so the next session starts one step heavier.
    assert entry["suggested_weight_kg"] == 50


async def test_without_feedback_the_next_session_starts_from_the_last_weight(
    with_profile: AsyncClient,
):
    original, _, _ = await _workout(with_profile)
    await _log_set(with_profile, "2026-09-15", original["id"], 0, 45, 12)

    entry = (await with_profile.get(f"/days/{DAY}/workout")).json()["items"][0]

    assert entry["suggested_weight_kg"] == 45


async def test_a_first_time_exercise_has_no_history(with_profile: AsyncClient):
    await _workout(with_profile)

    entry = (await with_profile.get(f"/days/{DAY}/workout")).json()["items"][0]

    assert entry["last_set"] is None
    assert entry["best_weight_kg"] is None
    assert entry["suggested_weight_kg"] is None


async def test_day_items_say_which_equipment_the_exercise_uses(with_profile: AsyncClient):
    """A blank weight means 'not set' for a barbell lift, but 'none' for a push-up."""
    push_up = (
        await with_profile.post(
            "/exercises",
            json={"category_id": "strength", "name": "伏地挺身", "equipment": "bodyweight"},
        )
    ).json()
    template = (
        await with_profile.post(
            "/workout-templates",
            json={
                "category_id": "strength",
                "name": "徒手日",
                "location": "home",
                "items": [{"exercise_id": push_up["id"], "sets": 3, "reps": "12"}],
            },
        )
    ).json()
    schedule = [{"weekday": 1, "template_id": template["id"]}]
    await with_profile.put("/workout-schedule", json=schedule)

    items = await _day_items(with_profile)

    assert items[0]["equipment"] == "bodyweight"


async def test_todays_target_counts_the_workout_once_it_is_done(with_exercises: AsyncClient):
    await _profile(with_exercises)
    today = datetime.now(ZoneInfo("Asia/Taipei")).date()
    template = (
        await with_exercises.post(
            "/workout-templates",
            json={
                "category_id": "strength",
                "name": "全身",
                "location": "home",
                "duration_min": 60,
                "items": [
                    {"exercise_id": "barbell-back-squat", "sets": 1, "reps": "10"},
                    {"exercise_id": "barbell-bench-press", "sets": 1, "reps": "10"},
                ],
            },
        )
    ).json()
    await with_exercises.put(
        "/workout-schedule",
        json=[{"weekday": today.weekday(), "location": "home", "template_id": template["id"]}],
    )

    # Before training the planned hour adds nothing yet.
    before = (await with_exercises.get(f"/days/{today}")).json()["targets"]
    assert (before["base_kcal"], before["exercise_kcal"], before["kcal"]) == (1340, 0, 1340)

    squat = (await with_exercises.get(f"/days/{today}/workout")).json()["items"][0]["item"]
    await with_exercises.put(
        f"/days/{today}/workout/sets",
        json={
            "day_workout_item_id": squat["id"],
            "exercise_id": squat["exercise_id"],
            "set_index": 0,
        },
    )
    # Nor does a set logged halfway through.
    assert (await with_exercises.get(f"/days/{today}")).json()["targets"]["exercise_kcal"] == 0

    # Finished with only the squat's one set done, and no clock: the set's own 90 s count,
    # 4 x 56 x 90 s = 6 kcal, half of it added back.
    await with_exercises.patch(f"/days/{today}", json={"workout_done": True})
    assert (await with_exercises.get(f"/days/{today}")).json()["targets"]["exercise_kcal"] == 3

    # Focus mode clocked half an hour for it.
    await with_exercises.patch(f"/days/{today}", json={"trained_sec": 1800})
    assert (await with_exercises.get(f"/days/{today}")).json()["targets"]["exercise_kcal"] == 56

    # The profile's own targets never include a workout.
    profile = (await with_exercises.get("/users/me/profile")).json()["targets"]
    assert (profile["exercise_kcal"], profile["kcal"]) == (0, 1340)


async def _unplanned_day(client: AsyncClient, day: str = DAY) -> tuple[str, str]:
    """A squat and a treadmill walk added by hand: no template, so no planned minutes."""
    await _profile(client)
    for exercise_id, prescription in (
        ("barbell-back-squat", {"sets": 3, "reps": "10"}),
        ("incline-treadmill-walk", {"duration_sec": 600}),
    ):
        added = await client.post(
            f"/days/{day}/workout/items", json={"exercise_id": exercise_id, **prescription}
        )
        assert added.status_code == 201
    workout = (await client.get(f"/days/{day}/workout")).json()
    squat, walk = (entry["item"]["id"] for entry in workout["items"])
    return squat, walk


async def test_counted_sets_burn_without_a_template(with_exercises: AsyncClient):
    squat, _walk = await _unplanned_day(with_exercises)
    recorded = await with_exercises.put(
        f"/days/{DAY}/workout/items/{squat}/sets",
        json={"sets": [{"reps_done": 10, "weight_kg": 60}] * 3},
    )
    assert recorded.status_code == 200
    # Each set is 10 reps x 3 s + 60 s rest: (5 - 1) x 56 kg x 270 s. It used to be nothing.
    assert (await with_exercises.get(f"/days/{DAY}/workout")).json()["estimated_burn_kcal"] == 17


async def test_focus_time_goes_to_the_counted_work(with_exercises: AsyncClient):
    squat, walk = await _unplanned_day(with_exercises)
    await with_exercises.put(
        f"/days/{DAY}/workout/items/{squat}/sets", json={"sets": [{"reps_done": 10}] * 3}
    )
    await with_exercises.put(
        f"/days/{DAY}/workout/items/{walk}/sets", json={"sets": [{"duration_sec": 600}]}
    )

    async def burn() -> int:
        return (await with_exercises.get(f"/days/{DAY}/workout")).json()["estimated_burn_kcal"]

    # Walk: (6 - 1) x 56 x 600 s = 47. Squat alone, unclocked: 4 x 56 x 270 s = 17.
    assert await burn() == 63

    # 40 clocked minutes, 10 of them the walk's: the squat had the other 30, 112 kcal.
    await with_exercises.patch(f"/days/{DAY}", json={"workout_done": True, "trained_sec": 2400})
    assert await burn() == 159

    # A session resumed later adds its own minutes rather than replacing the first.
    await with_exercises.patch(f"/days/{DAY}", json={"trained_sec": 600})
    assert await burn() == 196


async def test_a_clock_shorter_than_the_sets_never_lowers_the_estimate(
    with_exercises: AsyncClient,
):
    squat, walk = await _unplanned_day(with_exercises)
    await with_exercises.put(
        f"/days/{DAY}/workout/items/{squat}/sets", json={"sets": [{"reps_done": 10}] * 3}
    )
    await with_exercises.put(
        f"/days/{DAY}/workout/items/{walk}/sets", json={"sets": [{"duration_sec": 600}]}
    )
    # A minute on the clock while the walk alone was ten: the walk was done off the clock.
    await with_exercises.patch(f"/days/{DAY}", json={"trained_sec": 60})
    assert (await with_exercises.get(f"/days/{DAY}/workout")).json()["estimated_burn_kcal"] == 63


async def test_a_skipped_workout_adds_nothing_today(with_exercises: AsyncClient):
    today = datetime.now(ZoneInfo("Asia/Taipei")).date().isoformat()
    _squat, walk = await _unplanned_day(with_exercises, today)
    await with_exercises.put(
        f"/days/{today}/workout/items/{walk}/sets", json={"sets": [{"duration_sec": 600}]}
    )
    await with_exercises.patch(f"/days/{today}", json={"workout_skipped": True})
    assert (await with_exercises.get(f"/days/{today}")).json()["targets"]["exercise_kcal"] == 0


async def test_a_past_day_counts_what_was_logged(with_exercises: AsyncClient):
    # The day is over, so its record stands whether or not it was marked done.
    _squat, walk = await _unplanned_day(with_exercises)
    await with_exercises.put(
        f"/days/{DAY}/workout/items/{walk}/sets", json={"sets": [{"duration_sec": 600}]}
    )
    # Walk: (6 - 1) x 56 kg x 600 s = 47, half of it added back.
    assert (await with_exercises.get(f"/days/{DAY}")).json()["targets"]["exercise_kcal"] == 24


async def test_rewriting_a_record_keeps_when_its_sets_were_logged(with_profile: AsyncClient):
    original, _, _template = await _workout(with_profile)
    item_id = (await _day_items(with_profile))[0]["id"]
    await with_profile.put(
        f"/days/{DAY}/workout/sets",
        json={
            "day_workout_item_id": item_id,
            "exercise_id": original["id"],
            "set_index": 0,
            "reps_done": 10,
        },
    )
    first = (await with_profile.get(f"/days/{DAY}/workout")).json()["items"][0]["logs"][0]

    await with_profile.put(
        f"/days/{DAY}/workout/items/{item_id}/sets",
        json={"sets": [{"reps_done": 12}, {"reps_done": 10}]},
    )
    logs = (await with_profile.get(f"/days/{DAY}/workout")).json()["items"][0]["logs"]
    # The fixed set keeps its time; the one added afterwards takes the day's last, so the
    # edit adds no gap that would read as training time.
    assert [log["done_at"] for log in logs] == [first["done_at"]] * 2
    assert [log["reps_done"] for log in logs] == [12, 10]


async def test_a_treadmill_set_keeps_its_speed_and_incline(with_exercises: AsyncClient):
    _squat, walk = await _unplanned_day(with_exercises)
    logged = await with_exercises.put(
        f"/days/{DAY}/workout/sets",
        json={
            "day_workout_item_id": walk,
            "exercise_id": "incline-treadmill-walk",
            "set_index": 0,
            "duration_sec": 2400,
            "speed_kmh": 4,
            "incline_pct": 10,
        },
    )
    assert logged.status_code == 200
    workout = (await with_exercises.get(f"/days/{DAY}/workout")).json()
    log = workout["items"][1]["logs"][0]
    assert (log["speed_kmh"], log["incline_pct"]) == (4, 10)
    # Costed by the ACSM walking equation: (6.33 - 1) x 56 kg x 40 min.
    assert workout["estimated_burn_kcal"] == 199

    # The next time the walk comes up, it starts from the same speed and incline.
    later = "2026-09-29"
    added = await with_exercises.post(
        f"/days/{later}/workout/items",
        json={"exercise_id": "incline-treadmill-walk", "duration_sec": 600},
    )
    last = added.json()["items"][0]["last_set"]
    assert (last["speed_kmh"], last["incline_pct"]) == (4, 10)


async def test_a_typed_in_record_keeps_speed_and_incline(with_exercises: AsyncClient):
    _squat, walk = await _unplanned_day(with_exercises)
    recorded = await with_exercises.put(
        f"/days/{DAY}/workout/items/{walk}/sets",
        json={"sets": [{"duration_sec": 2400, "speed_kmh": 4, "incline_pct": 10}]},
    )
    assert recorded.status_code == 200
    log = (await with_exercises.get(f"/days/{DAY}/workout")).json()["items"][1]["logs"][0]
    assert (log["speed_kmh"], log["incline_pct"]) == (4, 10)


async def test_an_impossible_speed_or_incline_is_rejected(with_exercises: AsyncClient):
    _squat, walk = await _unplanned_day(with_exercises)
    for bad in ({"speed_kmh": 0}, {"speed_kmh": 31}, {"incline_pct": -1}, {"incline_pct": 41}):
        response = await with_exercises.put(
            f"/days/{DAY}/workout/items/{walk}/sets",
            json={"sets": [{"duration_sec": 600, **bad}]},
        )
        assert response.status_code == 422, bad


async def test_reps_are_a_number_or_a_range(with_exercises: AsyncClient):
    await _profile(with_exercises)
    for reps, status in (("12", 201), ("10-12", 201), ("10–12", 201), ("abc", 422), ("10次", 422)):
        response = await with_exercises.post(
            f"/days/{DAY}/workout/items",
            json={"exercise_id": "barbell-back-squat", "sets": 3, "reps": reps},
        )
        assert response.status_code == status, reps
    item_id = (await _day_items(with_exercises))[0]["id"]
    patched = await with_exercises.patch(
        f"/days/{DAY}/workout/items/{item_id}", json={"reps": "abc"}
    )
    assert patched.status_code == 422
    template = await with_exercises.post(
        "/workout-templates",
        json={
            "category_id": "strength",
            "name": "壞次數",
            "items": [{"exercise_id": "barbell-back-squat", "sets": 3, "reps": "abc"}],
        },
    )
    assert template.status_code == 422

