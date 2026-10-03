"""Daily calorie and macro targets.

The single implementation of the spec's "nutrition and calculation rules" section.
"""

from datetime import date

from app.domain.models import ActivityLevel, Profile, Sex, Targets

# Daily life without exercise: the job and getting about. Exercise is not priced in here; the
# day's own workout is added on top (see compute_targets), so one session is never counted
# both as a habit and as the thing that happened.
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
# Share of a workout's estimated burn that goes back into the day. MET estimates run high
# and eating it all back would quietly close the deficit, so only half is returned.
EXERCISE_EAT_BACK = 0.5


def compute_targets(profile: Profile, today: date, exercise_kcal: int = 0) -> Targets:
    """Compute the day's targets from a profile. Pure: same input, same output, always.

    The base is the day without exercise: BMR x the daily-life factor, less the deficit,
    and never below BMR or the floor. `exercise_kcal` is the day's estimated workout burn
    beyond resting; half of it is added on top, all of it as carbs, since protein and fat
    follow body weight.
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
    base_kcal = max(round(tdee * (1 - profile.deficit_pct / 100)), bmr, floor)
    eaten_back = round(max(exercise_kcal, 0) * EXERCISE_EAT_BACK)
    kcal = base_kcal + eaten_back

    protein_g = round(profile.weight_kg * PROTEIN_G_PER_KG)
    fat_g = round(profile.weight_kg * FAT_G_PER_KG)
    carb_kcal = kcal - protein_g * KCAL_PER_G_PROTEIN - fat_g * KCAL_PER_G_FAT
    carb_g = max(round(carb_kcal / KCAL_PER_G_CARB), 0)

    return Targets(
        bmr=bmr,
        tdee=tdee,
        base_kcal=base_kcal,
        exercise_kcal=eaten_back,
        kcal=kcal,
        protein_g=protein_g,
        fat_g=fat_g,
        carb_g=carb_g,
    )
