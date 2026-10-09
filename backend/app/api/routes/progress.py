from datetime import date

from fastapi import APIRouter, Query

from app.api.deps import CurrentUserId, Profiles, Progress
from app.api.schemas import CalendarMonthOut, WeeklyReviewOut

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/calendar", response_model=CalendarMonthOut)
async def calendar(
    user_id: CurrentUserId,
    service: Progress,
    profiles: Profiles,
    month: str | None = Query(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
) -> CalendarMonthOut:
    """One month's days, marked complete or not; this month when none is given."""
    profile = await profiles.get(user_id)
    first = None
    if month:
        year, number = month.split("-")
        first = date(int(year), int(number), 1)
    return CalendarMonthOut.of(await service.calendar(user_id, first, profile.timezone))


@router.get("/weekly", response_model=WeeklyReviewOut)
async def weekly(
    user_id: CurrentUserId,
    service: Progress,
    profiles: Profiles,
    week: date | None = None,
) -> WeeklyReviewOut:
    """The week `week` falls in, Monday to Sunday; the last finished week when none is given."""
    profile = await profiles.get(user_id)
    return WeeklyReviewOut.of(await service.weekly(user_id, week, profile.timezone))
