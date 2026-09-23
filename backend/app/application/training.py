"""訓練:動作庫、課表與其動作、一週排程。"""

from dataclasses import replace

from app.application.ports import TrainingStore
from app.domain.errors import NotFound
from app.domain.ids import new_id
from app.domain.models import Exercise, ScheduleEntry, WorkoutTemplate


class TrainingService:
    def __init__(self, store: TrainingStore) -> None:
        self._store = store

    async def exercises(self, user_id: str) -> tuple[Exercise, ...]:
        return await self._store.list_exercises(user_id)

    async def add_exercise(
        self, user_id: str, *, category_id: str, name: str, description: str | None
    ) -> Exercise:
        exercise = Exercise(
            id=new_id(),
            category_id=category_id,
            name=name,
            description=description,
            is_builtin=False,
        )
        await self._store.save_exercise(user_id, exercise)
        return exercise

    async def edit_exercise(self, user_id: str, exercise: Exercise) -> None:
        if exercise.is_builtin:
            raise NotFound("內建動作不能修改,請先複製一份")
        await self._store.save_exercise(user_id, exercise)

    async def remove_exercise(self, user_id: str, exercise_id: str) -> None:
        await self._store.archive_exercise(user_id, exercise_id)

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
        await self._store.save_template(user_id, stored)
        if stored.items:
            await self._store.replace_items(user_id, stored.id, stored.items)
        return stored

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
            replace(by_id[item_id], sort_order=index)
            for index, item_id in enumerate(item_ids)
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
