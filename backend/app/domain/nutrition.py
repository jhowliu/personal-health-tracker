"""Daily calorie and macro targets.

The single implementation of the spec's "nutrition and calculation rules" section.
"""

from datetime import date

from app.domain.models import ActivityLevel, Profile, Sex, Targets

ACTIVITY_FACTOR: dict[ActivityLevel, float] = {
    ActivityLevel.SEDENTARY: 1.2,
    ActivityLevel.LIGHT: 1.375,
    ActivityLevel.MODERATE: 1.55,
    ActivityLevel.ACTIVE: 1.725,
}

PROTEIN_G_PER_KG = 1.8
FAT_G_PER_KG = 0.8
KCAL_PER_G_PROTEIN = 4
KCAL_PER_G_FAT = 9
KCAL_PER_G_CARB = 4
FEMALE_KCAL_FLOOR = 1200
MALE_KCAL_FLOOR = 1500


def compute_targets(profile: Profile, today: date) -> Targets:
    """Compute the day's targets from a profile. Pure: same input, same output, always.

    carb_scale = current carb target / the meal baseline carb target. Pinned to 1.0 when
    auto_scale_carbs is off.
    """
    sex_offset = -161 if profile.sex is Sex.FEMALE else 5
    bmr = round(
        10 * profile.weight_kg
        + 6.25 * profile.height_cm
        - 5 * profile.age_on(today)
        + sex_offset
    )
    tdee = round(bmr * ACTIVITY_FACTOR[profile.activity_level])

    floor = FEMALE_KCAL_FLOOR if profile.sex is Sex.FEMALE else MALE_KCAL_FLOOR
    kcal = max(round(tdee * (1 - profile.deficit_pct / 100)), bmr, floor)

    protein_g = round(profile.weight_kg * PROTEIN_G_PER_KG)
    fat_g = round(profile.weight_kg * FAT_G_PER_KG)
    carb_kcal = kcal - protein_g * KCAL_PER_G_PROTEIN - fat_g * KCAL_PER_G_FAT
    carb_g = max(round(carb_kcal / KCAL_PER_G_CARB), 0)

    scale = 1.0
    if profile.auto_scale_carbs and profile.carb_base_g > 0:
        scale = round(carb_g / profile.carb_base_g, 4)

    return Targets(
        bmr=bmr,
        tdee=tdee,
        kcal=kcal,
        protein_g=protein_g,
        fat_g=fat_g,
        carb_g=carb_g,
        carb_scale=scale,
    )
