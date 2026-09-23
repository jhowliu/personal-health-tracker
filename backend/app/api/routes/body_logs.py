from datetime import date

from fastapi import APIRouter, status

from app.api.deps import BodyTracking, CurrentUserId, Profiles
from app.api.schemas import BodyLogIn, BodyLogOut, BodySummaryOut
from app.domain.models import BodyLog

router = APIRouter(prefix="/body-logs", tags=["body"])


@router.get("", response_model=list[BodyLogOut])
async def history(
    user_id: CurrentUserId,
    service: BodyTracking,
    profiles: Profiles,
    from_: date | None = None,
    to: date | None = None,
) -> list[BodyLogOut]:
    profile = await profiles.get(user_id)
    logs = await service.history(user_id, from_, to, profile.timezone)
    return [BodyLogOut.of(log) for log in logs]


@router.get("/summary", response_model=BodySummaryOut)
async def summary(
    user_id: CurrentUserId,
    service: BodyTracking,
    profiles: Profiles,
    from_: date | None = None,
    to: date | None = None,
) -> BodySummaryOut:
    profile = await profiles.get(user_id)
    return BodySummaryOut.of(await service.summary(user_id, from_, to, profile.timezone))


@router.put("/{day}", response_model=BodyLogOut)
async def record(
    day: date, payload: BodyLogIn, user_id: CurrentUserId, service: BodyTracking
) -> BodyLogOut:
    log = BodyLog(date=day, weight_kg=payload.weight_kg, waist_cm=payload.waist_cm)
    await service.record(user_id, log)
    return BodyLogOut.of(log)


@router.delete("/{day}", status_code=status.HTTP_204_NO_CONTENT)
async def remove(day: date, user_id: CurrentUserId, service: BodyTracking) -> None:
    await service.remove(user_id, day)
