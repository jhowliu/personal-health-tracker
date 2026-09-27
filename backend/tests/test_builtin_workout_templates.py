from httpx import AsyncClient

from seeds.exercises import seed as seed_exercises
from seeds.workout_templates import TEMPLATES
from seeds.workout_templates import seed as seed_workout_templates


async def test_builtin_templates_are_global_read_only_and_schedulable(
    with_profile: AsyncClient,
):
    await seed_exercises()
    assert await seed_workout_templates() == len(TEMPLATES)
    assert await seed_workout_templates() == len(TEMPLATES)

    listed = (await with_profile.get("/workout-templates")).json()
    assert [template["id"] for template in listed] == [
        "beginner-full-body-a",
        "beginner-full-body-b",
        "beginner-full-body-c",
    ]
    assert all(template["is_builtin"] for template in listed)
    assert all(len(template["items"]) == 6 for template in listed)

    scheduled = await with_profile.put(
        "/workout-schedule",
        json=[{"weekday": 1, "template_id": "beginner-full-body-a"}],
    )
    assert scheduled.status_code == 200

    workout = (await with_profile.get("/days/2026-09-22/workout")).json()
    assert workout["template"]["id"] == "beginner-full-body-a"
    assert workout["template"]["is_builtin"] is True
    assert len(workout["items"]) == 6

    assert (
        await with_profile.delete("/workout-templates/beginner-full-body-a")
    ).status_code == 403
    assert (
        await with_profile.put(
            "/workout-templates/beginner-full-body-a",
            json={
                "category_id": listed[0]["category_id"],
                "name": "不能修改公用課表",
                "duration_min": listed[0]["duration_min"],
                "items": [
                    {
                        "id": item["id"],
                        "exercise_id": item["exercise_id"],
                        "sets": item["sets"],
                        "reps": item["reps"],
                        "rest_sec": item["rest_sec"],
                    }
                    for item in listed[0]["items"]
                ],
            },
        )
    ).status_code == 403
    assert (
        await with_profile.put(
            "/workout-templates/beginner-full-body-a/items/order",
            json={"item_ids": [item["id"] for item in listed[0]["items"]]},
        )
    ).status_code == 403


async def test_builtin_template_can_be_copied_without_becoming_account_data(
    with_profile: AsyncClient,
):
    await seed_exercises()
    await seed_workout_templates()

    copied_response = await with_profile.post("/workout-templates/beginner-full-body-a/copy")
    assert copied_response.status_code == 201
    copied = copied_response.json()
    assert copied["is_builtin"] is False
    assert copied["name"] == "初階全身 A 副本"
    assert [item["exercise_id"] for item in copied["items"]] == [
        item.exercise_id for item in TEMPLATES[0].items
    ]
    assert not ({item["id"] for item in copied["items"]} & {item.id for item in TEMPLATES[0].items})

    first_user_token = with_profile.headers["Authorization"]
    registered = await with_profile.post(
        "/auth/register", json={"email": "other@example.com", "password": "supersecret"}
    )
    with_profile.headers["Authorization"] = f"Bearer {registered.json()['access_token']}"

    hidden = await with_profile.put(
        "/workout-schedule", json=[{"weekday": 1, "template_id": copied["id"]}]
    )
    assert hidden.status_code == 404
    assert len((await with_profile.get("/workout-templates")).json()) == 3

    with_profile.headers["Authorization"] = first_user_token
    assert (await with_profile.delete("/users/me")).status_code == 204
    with_profile.headers["Authorization"] = f"Bearer {registered.json()['access_token']}"
    assert len((await with_profile.get("/workout-templates")).json()) == 3
