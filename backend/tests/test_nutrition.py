from datetime import date

from app.domain.models import ActivityLevel, Location, Profile, Sex, WorkoutTime
from app.domain.nutrition import compute_targets


def build_profile(**overrides) -> Profile:
    defaults = dict(
        user_id="u1",
        sex=Sex.FEMALE,
        birth_date=date(1995, 1, 1),
        height_cm=164.0,
        weight_kg=56.0,
        activity_level=ActivityLevel.SEDENTARY,
        deficit_pct=12,
        workout_time=WorkoutTime.PM,
        default_location=Location.HOME,
        reminder_time="07:00",
        timezone="Asia/Taipei",
    )
    return Profile(**{**defaults, **overrides})


def test_matches_spec_example():
    """The spec's worked example: 164 cm, 56 kg, 31-year-old female, sedentary, 12%."""
    targets = compute_targets(build_profile(), date(2026, 9, 22))

    assert targets.bmr == 1269
    assert targets.tdee == 1523
    assert targets.kcal == 1340
    assert targets.protein_g == 101
    assert targets.fat_g == 45
    assert targets.carb_g == 133


def test_never_dips_below_bmr():
    targets = compute_targets(build_profile(deficit_pct=20), date(2026, 9, 22))
    assert targets.kcal >= targets.bmr


def test_female_floor_applies():
    tiny = build_profile(weight_kg=40.0, height_cm=150.0, deficit_pct=20)
    assert compute_targets(tiny, date(2026, 9, 22)).kcal >= 1200


def test_half_the_workout_burn_is_added_back_as_carbs():
    rest_day = compute_targets(build_profile(), date(2026, 9, 22))
    workout_day = compute_targets(build_profile(), date(2026, 9, 22), exercise_kcal=300)

    assert rest_day.exercise_kcal == 0
    assert rest_day.kcal == rest_day.base_kcal == 1340
    assert workout_day.base_kcal == 1340
    assert workout_day.exercise_kcal == 150
    assert workout_day.kcal == 1490
    # Every added kcal is carbs; the 1 g of slack is each target's own rounding.
    assert abs((workout_day.carb_g - rest_day.carb_g) - 150 / 4) <= 1
    assert workout_day.protein_g == rest_day.protein_g
    assert workout_day.fat_g == rest_day.fat_g


def test_age_comes_from_birth_date():
    before_birthday = compute_targets(build_profile(), date(2025, 12, 31))
    after_birthday = compute_targets(build_profile(), date(2026, 1, 2))
    assert after_birthday.bmr < before_birthday.bmr
