from datetime import date

from fastapi import APIRouter, Query, status

from app.api.deps import CurrentUserId, Profiles, Progress, WeeklyAdvice
from app.api.schemas import (
    CalendarMonthOut,
    VolumeTrendOut,
    WeeklyAdviceOut,
    WeeklyReviewOut,
    WeekSummaryOut,
    WeekVolumeOut,
)

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


@router.get("/weekly/pending", response_model=WeeklyReviewOut | None)
async def pending_week(
    user_id: CurrentUserId, service: Progress, profiles: Profiles
) -> WeeklyReviewOut | None:
    """The report to pop up once: the last finished week, or this one on a Sunday whose flow is
    done. null when it was already shown or the week held nothing."""
    profile = await profiles.get(user_id)
    review = await service.pending(user_id, profile.timezone)
    return WeeklyReviewOut.of(review) if review else None


@router.post("/weekly/{week}/seen", status_code=status.HTTP_204_NO_CONTENT)
async def week_seen(week: date, user_id: CurrentUserId, service: Progress) -> None:
    """The report of the week `week` falls in was shown, so it does not pop up again."""
    await service.mark_seen(user_id, week)


@router.get("/weeks", response_model=list[WeekSummaryOut])
async def weeks(
    user_id: CurrentUserId, service: Progress, profiles: Profiles
) -> list[WeekSummaryOut]:
    """Weeks with anything logged and a report to read, newest first."""
    profile = await profiles.get(user_id)
    return [WeekSummaryOut.of(week) for week in await service.weeks(user_id, profile.timezone)]


@router.post("/weekly/{week}/advice", response_model=WeeklyAdviceOut | None)
async def week_advice(
    week: date, user_id: CurrentUserId, service: WeeklyAdvice, profiles: Profiles
) -> WeeklyAdviceOut | None:
    """The AI review of the week `week` falls in, written on the first call and kept.

    428 until the user agrees to AI analysis; null for a week with nothing logged.
    """
    profile = await profiles.get(user_id)
    advice = await service.advice(user_id, week, profile.timezone)
    return WeeklyAdviceOut.of(advice) if advice else None


@router.get("/volume", response_model=VolumeTrendOut)
async def volume_trend(
    user_id: CurrentUserId,
    service: Progress,
    profiles: Profiles,
    weeks: int = Query(default=12, ge=4, le=52),
) -> VolumeTrendOut:
    """Weight × reps per week for the last `weeks` weeks, this one included, oldest first."""
    profile = await profiles.get(user_id)
    this_week, volumes = await service.volume_trend(user_id, profile.timezone, weeks)
    return VolumeTrendOut(
        this_week=this_week,
        weeks=[WeekVolumeOut(start=week.start, volume_kg=week.volume_kg) for week in volumes],
    )
