from fastapi import APIRouter, status

from app.api.deps import Accounts, CurrentUserId, Profiles
from app.api.schemas import (
    ProfileIn,
    ProfileOut,
    ProfilePatch,
    ProfileWithTargetsOut,
    RemindersPatch,
    TargetsOut,
)
from app.domain.models import (
    ActivityLevel,
    Location,
    Profile,
    Sex,
    WorkoutTime,
)

router = APIRouter(prefix="/users/me", tags=["users"])


@router.get("/profile", response_model=ProfileWithTargetsOut)
async def read_profile(user_id: CurrentUserId, service: Profiles) -> ProfileWithTargetsOut:
    profile = await service.get(user_id)
    return ProfileWithTargetsOut(
        profile=ProfileOut.of(profile),
        targets=TargetsOut.of(await service.targets(user_id)),
    )


@router.put("/profile", response_model=ProfileWithTargetsOut)
async def replace_profile(
    payload: ProfileIn, user_id: CurrentUserId, service: Profiles
) -> ProfileWithTargetsOut:
    profile, targets = await service.create_or_replace(_to_profile(user_id, payload))
    return ProfileWithTargetsOut(profile=ProfileOut.of(profile), targets=TargetsOut.of(targets))


def _to_profile(user_id: str, payload: ProfileIn) -> Profile:
    return Profile(
        user_id=user_id,
        sex=Sex(payload.sex),
        birth_date=payload.birth_date,
        height_cm=payload.height_cm,
        weight_kg=payload.weight_kg,
        activity_level=ActivityLevel(payload.activity_level),
        deficit_pct=payload.deficit_pct,
        carb_base_g=0,
        auto_scale_carbs=payload.auto_scale_carbs,
        auto_assign_meals=payload.auto_assign_meals,
        workout_time=WorkoutTime(payload.workout_time),
        default_location=Location(payload.default_location),
        reminder_time=payload.reminder_time,
        timezone=payload.timezone,
    )


@router.post("/targets/preview", response_model=TargetsOut)
async def preview_targets(
    payload: ProfileIn, user_id: CurrentUserId, service: Profiles
) -> TargetsOut:
    """The profile-setup screen shows targets as the user types. Nothing is stored."""
    return TargetsOut.of(service.preview(_to_profile(user_id, payload)))


@router.patch("/profile", response_model=ProfileWithTargetsOut)
async def update_profile(
    payload: ProfilePatch, user_id: CurrentUserId, service: Profiles
) -> ProfileWithTargetsOut:
    enums = {
        "sex": Sex,
        "activity_level": ActivityLevel,
        "workout_time": WorkoutTime,
        "default_location": Location,
    }
    changes = {
        key: enums[key](value) if key in enums else value
        for key, value in payload.model_dump(exclude_unset=True).items()
    }
    profile, targets = await service.update(user_id, changes)
    return ProfileWithTargetsOut(profile=ProfileOut.of(profile), targets=TargetsOut.of(targets))


@router.get("/targets", response_model=TargetsOut)
async def read_targets(user_id: CurrentUserId, service: Profiles) -> TargetsOut:
    return TargetsOut.of(await service.targets(user_id))


@router.patch("/reminders", response_model=ProfileOut)
async def update_reminders(
    payload: RemindersPatch, user_id: CurrentUserId, service: Profiles
) -> ProfileOut:
    profile, _ = await service.update(user_id, payload.model_dump(exclude_unset=True))
    return ProfileOut.of(profile)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(user_id: CurrentUserId, service: Accounts) -> None:
    await service.delete_account(user_id)
