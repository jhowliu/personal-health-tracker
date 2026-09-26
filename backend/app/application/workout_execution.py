from dataclasses import replace
from datetime import date

from app.application.ports import AccountStore, Clock, WorkoutExecutionStore
from app.domain.errors import NotFound, ValidationFailed
from app.domain.ids import new_id
from app.domain.workout_execution import (
    DayWorkoutItem,
    ReplacementReason,
    SetEffort,
    SetLog,
    SetLogResult,
    WorkoutExecution,
    estimate_burn_kcal,
    recommend_next_weight,
)


class WorkoutExecutionService:
    """Daily workout facts and progression, isolated from editable template management."""

    def __init__(
        self, store: WorkoutExecutionStore, accounts: AccountStore, clock: Clock
    ) -> None:
        self._store = store
        self._accounts = accounts
        self._clock = clock

    async def view(self, user_id: str, day: date) -> WorkoutExecution:
        profile = await self._profile(user_id)
        workout = await self._store.load(user_id, day, profile)
        return replace(
            workout, estimated_burn_kcal=estimate_burn_kcal(workout, profile.weight_kg)
        )

    async def add_item(
        self,
        user_id: str,
        day: date,
        *,
        exercise_id: str,
        sets: int | None,
        reps: str | None,
        duration_sec: int | None,
        weight_kg: float | None,
        rest_sec: int,
        note: str | None,
    ) -> WorkoutExecution:
        profile = await self._profile(user_id)
        await self.view(user_id, day)  # Materialise any scheduled snapshot before appending.
        exercise = await self._store.load_visible_exercise(user_id, exercise_id)
        if exercise is None:
            raise NotFound("找不到可使用的動作")
        await self._store.add_item(
            user_id,
            day,
            profile,
            DayWorkoutItem(
                id=new_id(),
                exercise_id=exercise.id,
                exercise_name=exercise.name,
                sort_order=0,
                sets=sets,
                reps=reps,
                duration_sec=duration_sec,
                weight_kg=weight_kg,
                rest_sec=rest_sec,
                note=note,
                met=exercise.met,
                replaced_exercise_name=None,
                replacement_reason=None,
                source_item_id=None,
            ),
        )
        return await self.view(user_id, day)

    async def update_item(
        self, user_id: str, day: date, item_id: str, changes: dict[str, object]
    ) -> WorkoutExecution:
        workout = await self.view(user_id, day)
        current = next((entry.item for entry in workout.items if entry.item.id == item_id), None)
        if current is None:
            raise NotFound("找不到今天排定的動作")

        requested_exercise_id = changes.pop("exercise_id", None)
        requested_reason = changes.pop("replacement_reason", None)
        replacing = (
            requested_exercise_id is not None and requested_exercise_id != current.exercise_id
        )
        if requested_reason is not None and not replacing:
            raise ValidationFailed("替換動作時才需要替換原因")
        if replacing and requested_reason is None:
            raise ValidationFailed("替換動作需要說明原因")

        item = current
        if replacing:
            exercise = await self._store.load_visible_exercise(user_id, str(requested_exercise_id))
            if exercise is None:
                raise NotFound("找不到可使用的替代動作")
            item = replace(
                item,
                exercise_id=exercise.id,
                exercise_name=exercise.name,
                met=exercise.met,
                replacement_reason=ReplacementReason(str(requested_reason)),
            )
        for field in ("sets", "reps", "duration_sec", "weight_kg", "rest_sec", "note"):
            if field in changes:
                item = replace(item, **{field: changes[field]})
        if (item.reps is None) == (item.duration_sec is None):
            raise ValidationFailed("動作需要次數或時間，但不能同時提供")
        if not await self._store.update_item(user_id, day, item, replacing=replacing):
            raise NotFound("找不到今天排定的動作")
        return await self.view(user_id, day)

    async def delete_item(self, user_id: str, day: date, item_id: str) -> None:
        await self.view(user_id, day)
        if not await self._store.delete_item(user_id, day, item_id):
            raise NotFound("找不到今天排定的動作")

    async def log_set(
        self,
        user_id: str,
        day: date,
        *,
        day_workout_item_id: str,
        exercise_id: str,
        set_index: int,
        reps_done: int | None,
        duration_sec: int | None,
        weight_kg: float | None,
        effort: SetEffort | None,
    ) -> SetLogResult:
        await self._store.log_set(
            user_id,
            day,
            await self._profile(user_id),
            SetLog(
                day_workout_item_id=day_workout_item_id,
                exercise_id=exercise_id,
                set_index=set_index,
                reps_done=reps_done,
                duration_sec=duration_sec,
                weight_kg=weight_kg,
                effort=effort,
                done_at=self._clock.now(),
            ),
        )
        return SetLogResult(recommend_next_weight(weight_kg, effort))

    async def apply_template_weight(
        self, user_id: str, template_id: str, item_id: str, weight_kg: float
    ) -> None:
        if not await self._store.apply_template_weight(user_id, template_id, item_id, weight_kg):
            raise NotFound("找不到這個課表動作")

    async def _profile(self, user_id: str):
        profile = await self._accounts.load_profile(user_id)
        if profile is None:
            raise NotFound("還沒有建立個人資料")
        return profile
