from datetime import date

import pytest

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
        carb_base_g=133.0,
        auto_scale_carbs=True,
        auto_assign_meals=True,
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


def test_carb_scale_tracks_target_against_base():
    lighter = build_profile(deficit_pct=20)
    targets = compute_targets(lighter, date(2026, 9, 22))
    assert targets.carb_scale == pytest.approx(targets.carb_g / 133.0, abs=1e-4)


def test_carb_scale_is_one_when_auto_adjust_off():
    targets = compute_targets(build_profile(auto_scale_carbs=False), date(2026, 9, 22))
    assert targets.carb_scale == 1.0


def test_age_comes_from_birth_date():
    before_birthday = compute_targets(build_profile(), date(2025, 12, 31))
    after_birthday = compute_targets(build_profile(), date(2026, 1, 2))
    assert after_birthday.bmr < before_birthday.bmr
