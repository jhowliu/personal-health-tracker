"""Rules about the shape of a workout template, independent of storage or HTTP."""

from collections.abc import Iterable

from app.domain.models import Location


def infer_location(locations: Iterable[str | None]) -> str:
    """Where a template can be done, from what its exercises say about themselves.

    One gym-only exercise makes the whole session a gym session; everything else — home,
    both, or an unanswered custom exercise — leaves it doable at home. The per-exercise
    value is a stated fact rather than something read off the equipment, which does not
    decide it: a treadmill can be at home and a cable stack never is.
    """
    needs_gym = any(location == Location.GYM.value for location in locations)
    return (Location.GYM if needs_gym else Location.HOME).value
