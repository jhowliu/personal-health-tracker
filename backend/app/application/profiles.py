"""Profile and daily targets.

Targets are always computed on the fly rather than stored, so they can never drift
out of sync with the profile.
"""

from dataclasses import replace
from datetime import date

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
        """On first setup, the carb target computed right now becomes the baseline that
        meal portions are stored against.
        """
        today = self._clock.today(profile.timezone)
        if profile.carb_base_g <= 0:
            seeded = replace(profile, carb_base_g=0, auto_scale_carbs=False)
            profile = replace(profile, carb_base_g=compute_targets(seeded, today).carb_g)

        await self._store.save_profile(profile)
        return profile, compute_targets(profile, today)

    async def update(self, user_id: str, changes: dict[str, object]) -> tuple[Profile, Targets]:
        profile = replace(await self.get(user_id), **changes)
        await self._store.save_profile(profile)
        return profile, compute_targets(profile, self._clock.today(profile.timezone))

    def preview(self, profile: Profile) -> Targets:
        """Compute targets for the screen before anything is saved. Touches no DB, and the
        formula still lives in exactly one place.
        """
        return compute_targets(profile, self._clock.today(profile.timezone))

    async def targets(self, user_id: str, on: date | None = None) -> Targets:
        profile = await self.get(user_id)
        return compute_targets(profile, on or self._clock.today(profile.timezone))
