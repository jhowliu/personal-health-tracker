"""Profile and daily targets.

Targets are always computed on the fly rather than stored, so they can never drift
out of sync with the profile.
"""

from dataclasses import replace
from datetime import date

from app.application.commands import ProfileChange, applied
from app.application.ports import AccountStore, Clock
from app.domain.errors import NotFound
from app.domain.models import Profile, Targets
from app.domain.nutrition import compute_targets


class ProfileService:
    def __init__(self, store: AccountStore, clock: Clock) -> None:
        self._store = store
        self._clock = clock

    async def get(self, user_id: str) -> Profile:
        profile = await self._store.load_profile(user_id)
        if profile is None:
            raise NotFound("還沒有建立個人資料")
        return profile

    async def create_or_replace(self, profile: Profile) -> tuple[Profile, Targets]:
        await self._store.save_profile(profile)
        return profile, compute_targets(profile, self._clock.today(profile.timezone))

    async def update(self, user_id: str, change: ProfileChange) -> tuple[Profile, Targets]:
        profile = replace(await self.get(user_id), **applied(change))
        await self._store.save_profile(profile)
        return profile, compute_targets(profile, self._clock.today(profile.timezone))

    def preview(self, profile: Profile) -> Targets:
        """Compute targets for the screen before anything is saved. Touches no DB, and the
        formula still lives in exactly one place.
        """
        return compute_targets(profile, self._clock.today(profile.timezone))

    async def targets(self, user_id: str, on: date | None = None) -> Targets:
        """The base targets, before any workout: the day's own burn is added by the today view."""
        profile = await self.get(user_id)
        return compute_targets(profile, on or self._clock.today(profile.timezone))
