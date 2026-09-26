"""Training: the exercise library, workout templates and their items, weekly schedule."""

from dataclasses import replace

from app.application.decisions import DecisionService
from app.application.ports import TrainingStore
from app.domain.errors import NotFound, PermissionDenied, ServiceUnavailable
from app.domain.ids import new_id
from app.domain.models import Exercise, Location, ScheduleEntry, TemplateItem, WorkoutTemplate
from app.domain.training import infer_location


class TrainingService:
    def __init__(self, store: TrainingStore, decisions: DecisionService) -> None:
        self._store = store
        self._decisions = decisions

    async def exercises(
        self,
        user_id: str,
        *,
        query: str | None = None,
        category_id: str | None = None,
        body_region: str | None = None,
        equipment: str | None = None,
    ) -> tuple[Exercise, ...]:
        return await self._store.search_exercises(
            user_id,
            query=query,
            category_id=category_id,
            body_region=body_region,
            equipment=equipment,
        )

    async def add_exercise(
        self,
        user_id: str,
        *,
        category_id: str,
        name: str,
        description: str | None,
        body_region: str | None,
        equipment: str | None,
        location: str | None,
    ) -> Exercise:
        exercise = Exercise(
            id=new_id(),
            category_id=category_id,
            name=name,
            description=description,
            body_region=body_region,
            equipment=equipment,
            location=location,
            # Custom exercises have no MET: there is no honest way to ask a user for one.
            met=None,
            is_builtin=False,
        )
        await self._store.save_exercise(user_id, exercise)
        return exercise

    async def edit_exercise(
        self,
        user_id: str,
        exercise_id: str,
        *,
        category_id: str,
        name: str,
        description: str | None,
        body_region: str | None,
        equipment: str | None,
        location: str | None,
    ) -> None:
        current = await self._exercise_owned_by(user_id, exercise_id)
        await self._store.save_exercise(
            user_id,
            replace(
                current,
                category_id=category_id,
                name=name,
                description=description,
                body_region=body_region,
                equipment=equipment,
                location=location,
            ),
        )

    async def remove_exercise(self, user_id: str, exercise_id: str) -> None:
        await self._exercise_owned_by(user_id, exercise_id)
        await self._store.archive_exercise(user_id, exercise_id)

    async def alternatives(
        self, user_id: str, exercise_id: str, reason: str | None
    ) -> tuple[tuple[Exercise, bool, str], ...]:
        source = await self._store.load_exercise(user_id, exercise_id)
        if source is None:
            raise NotFound("找不到這個動作")
        candidates = await self._store.search_exercises(
            user_id,
            query=None,
            category_id=source.category_id,
            body_region=None,
            equipment=None,
        )
        ranked = sorted(
            (candidate for candidate in candidates if candidate.id != source.id),
            key=lambda candidate: (
                candidate.body_region != source.body_region,
                candidate.equipment != source.equipment,
                candidate.name.casefold(),
                candidate.id,
            ),
        )
        preferred = await self._preferred(source, tuple(ranked), reason)
        if preferred is not None:
            ranked = [preferred] + [c for c in ranked if c.id != preferred.id]
        return tuple(
            (
                candidate,
                candidate.id == preferred.id
                if preferred is not None
                else candidate.body_region == source.body_region or source.body_region is None,
                _alternative_hint(source, candidate, reason),
            )
            for candidate in ranked
        )

    async def _preferred(
        self, source: Exercise, ranked: tuple[Exercise, ...], reason: str | None
    ) -> Exercise | None:
        """Let the decision layer pick the one substitute worth badging as the top pick.

        Returns None whenever that layer is unavailable or unsure, which leaves the
        deterministic order and the same-region rule in place — the fallback the spec
        describes for this step.
        """
        if not ranked:
            return None
        subject = f"{source.name}，原因：{_REASON_LABEL.get(reason or '', '想換動作')}"
        try:
            result = await self._decisions.exercise_alternative(subject, ranked)
        except ServiceUnavailable:
            return None
        return next((c for c in ranked if c.id == result.selection_id), None)

    async def _exercise_owned_by(self, user_id: str, exercise_id: str) -> Exercise:
        exercise = await self._store.load_exercise(user_id, exercise_id)
        if exercise is None:
            raise NotFound("找不到這個動作")
        if exercise.is_builtin:
            raise PermissionDenied("內建動作不能修改或刪除,請先建立自訂動作")
        return exercise

    async def templates(
        self, user_id: str, location: str | None = None
    ) -> tuple[WorkoutTemplate, ...]:
        return await self._store.list_templates(user_id, location)

    async def template(self, user_id: str, template_id: str) -> WorkoutTemplate:
        found = await self._store.load_template(user_id, template_id)
        if found is None:
            raise NotFound("找不到這個課表")
        return found

    async def save_template(self, user_id: str, template: WorkoutTemplate) -> WorkoutTemplate:
        stored = template if template.id else replace(template, id=new_id())
        stored = replace(stored, location=await self._location_for(user_id, stored.items))
        await self._store.save_template(user_id, stored)
        if stored.items:
            await self._store.replace_items(user_id, stored.id, stored.items)
        return stored

    async def _location_for(self, user_id: str, items: tuple[TemplateItem, ...]) -> str:
        if not items:
            return Location.HOME.value
        stated = {
            exercise.id: exercise.location
            for exercise in await self._store.search_exercises(
                user_id, query=None, category_id=None, body_region=None, equipment=None
            )
        }
        return infer_location(stated.get(item.exercise_id) for item in items)

    async def remove_template(self, user_id: str, template_id: str) -> None:
        await self._store.archive_template(user_id, template_id)

    async def reorder_items(
        self, user_id: str, template_id: str, item_ids: tuple[str, ...]
    ) -> WorkoutTemplate:
        current = await self.template(user_id, template_id)
        by_id = {item.id: item for item in current.items}
        missing = set(item_ids) ^ set(by_id)
        if missing:
            raise NotFound("順序清單和課表動作對不起來")

        reordered = tuple(
            replace(by_id[item_id], sort_order=index) for index, item_id in enumerate(item_ids)
        )
        await self._store.replace_items(user_id, template_id, reordered)
        return await self.template(user_id, template_id)

    async def schedule(self, user_id: str) -> tuple[ScheduleEntry, ...]:
        return await self._store.load_schedule(user_id)

    async def set_schedule(
        self, user_id: str, entries: tuple[ScheduleEntry, ...]
    ) -> tuple[ScheduleEntry, ...]:
        await self._store.replace_schedule(user_id, entries)
        return await self._store.load_schedule(user_id)


_REASON_LABEL = {"equipment": "沒有器材", "pain": "不舒服", "variety": "想換動作"}


def _alternative_hint(source: Exercise, candidate: Exercise, reason: str | None) -> str:
    region = "相同訓練區域" if candidate.body_region == source.body_region else "同類型替代"
    if reason == "equipment" and candidate.equipment != source.equipment:
        return f"{region}，改用不同器材"
    if reason == "pain":
        return f"{region}，請依疼痛情況調整活動範圍"
    return region
