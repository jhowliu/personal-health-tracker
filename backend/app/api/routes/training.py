from fastapi import APIRouter, status

from app.api.deps import CurrentUserId, Training
from app.api.schemas import (
    ExerciseIn,
    ExerciseOut,
    ItemOrderIn,
    ScheduleEntryIn,
    ScheduleEntryOut,
    TemplateIn,
    TemplateOut,
)
from app.domain.ids import new_id
from app.domain.models import Exercise, Location, ScheduleEntry, TemplateItem, WorkoutTemplate

router = APIRouter(tags=["training"])


@router.get("/exercises", response_model=list[ExerciseOut])
async def list_exercises(user_id: CurrentUserId, service: Training) -> list[ExerciseOut]:
    return [ExerciseOut.of(e) for e in await service.exercises(user_id)]


@router.post("/exercises", response_model=ExerciseOut, status_code=status.HTTP_201_CREATED)
async def add_exercise(
    payload: ExerciseIn, user_id: CurrentUserId, service: Training
) -> ExerciseOut:
    return ExerciseOut.of(
        await service.add_exercise(
            user_id,
            category_id=payload.category_id,
            name=payload.name,
            description=payload.description,
        )
    )


@router.patch("/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def edit_exercise(
    exercise_id: str, payload: ExerciseIn, user_id: CurrentUserId, service: Training
) -> None:
    await service.edit_exercise(
        user_id,
        Exercise(
            id=exercise_id,
            category_id=payload.category_id,
            name=payload.name,
            description=payload.description,
            is_builtin=False,
        ),
    )


@router.delete("/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_exercise(exercise_id: str, user_id: CurrentUserId, service: Training) -> None:
    await service.remove_exercise(user_id, exercise_id)


@router.get("/workout-templates", response_model=list[TemplateOut])
async def list_templates(
    user_id: CurrentUserId, service: Training, location: str | None = None
) -> list[TemplateOut]:
    return [TemplateOut.of(t) for t in await service.templates(user_id, location)]


@router.post(
    "/workout-templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED
)
async def create_template(
    payload: TemplateIn, user_id: CurrentUserId, service: Training
) -> TemplateOut:
    saved = await service.save_template(user_id, _to_template(new_id(), payload))
    return TemplateOut.of(await service.template(user_id, saved.id))


@router.get("/workout-templates/{template_id}", response_model=TemplateOut)
async def read_template(
    template_id: str, user_id: CurrentUserId, service: Training
) -> TemplateOut:
    return TemplateOut.of(await service.template(user_id, template_id))


@router.put("/workout-templates/{template_id}", response_model=TemplateOut)
async def replace_template(
    template_id: str, payload: TemplateIn, user_id: CurrentUserId, service: Training
) -> TemplateOut:
    await service.template(user_id, template_id)
    await service.save_template(user_id, _to_template(template_id, payload))
    return TemplateOut.of(await service.template(user_id, template_id))


@router.delete("/workout-templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_template(template_id: str, user_id: CurrentUserId, service: Training) -> None:
    await service.remove_template(user_id, template_id)


@router.put("/workout-templates/{template_id}/items/order", response_model=TemplateOut)
async def reorder_items(
    template_id: str, payload: ItemOrderIn, user_id: CurrentUserId, service: Training
) -> TemplateOut:
    return TemplateOut.of(
        await service.reorder_items(user_id, template_id, tuple(payload.item_ids))
    )


@router.get("/workout-schedule", response_model=list[ScheduleEntryOut])
async def read_schedule(user_id: CurrentUserId, service: Training) -> list[ScheduleEntryOut]:
    return [ScheduleEntryOut.of(e) for e in await service.schedule(user_id)]


@router.put("/workout-schedule", response_model=list[ScheduleEntryOut])
async def set_schedule(
    payload: list[ScheduleEntryIn], user_id: CurrentUserId, service: Training
) -> list[ScheduleEntryOut]:
    entries = tuple(
        ScheduleEntry(
            weekday=e.weekday, location=Location(e.location), template_id=e.template_id
        )
        for e in payload
    )
    return [ScheduleEntryOut.of(e) for e in await service.set_schedule(user_id, entries)]


def _to_template(template_id: str, payload: TemplateIn) -> WorkoutTemplate:
    return WorkoutTemplate(
        id=template_id,
        category_id=payload.category_id,
        name=payload.name,
        location=payload.location,
        duration_min=payload.duration_min,
        items=tuple(
            TemplateItem(
                id=item.id or new_id(),
                exercise_id=item.exercise_id,
                exercise_name="",
                sort_order=index,
                sets=item.sets,
                reps=item.reps,
                weight_kg=item.weight_kg,
                rest_sec=item.rest_sec,
                note=item.note,
            )
            for index, item in enumerate(payload.items)
        ),
    )
