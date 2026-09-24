from fastapi import APIRouter, status

from app.api.deps import CurrentUserId, Decisions, Training, WorkoutExecution
from app.api.schemas import (
    CategorySuggestionOut,
    ExerciseAlternativeOut,
    ExerciseIn,
    ExerciseOut,
    ItemOrderIn,
    ScheduleEntryIn,
    ScheduleEntryOut,
    SuggestionIn,
    TemplateIn,
    TemplateOut,
    TemplateWeightIn,
)
from app.domain.ids import new_id
from app.domain.models import Location, ScheduleEntry, TemplateItem, WorkoutTemplate

router = APIRouter(tags=["training"])


@router.get("/exercises", response_model=list[ExerciseOut])
async def list_exercises(
    user_id: CurrentUserId,
    service: Training,
    q: str | None = None,
    category_id: str | None = None,
    body_region: str | None = None,
    equipment: str | None = None,
) -> list[ExerciseOut]:
    return [
        ExerciseOut.of(e)
        for e in await service.exercises(
            user_id,
            query=q,
            category_id=category_id,
            body_region=body_region,
            equipment=equipment,
        )
    ]


@router.get("/exercises/{exercise_id}/alternatives", response_model=list[ExerciseAlternativeOut])
async def exercise_alternatives(
    exercise_id: str, user_id: CurrentUserId, service: Training, reason: str | None = None
) -> list[ExerciseAlternativeOut]:
    return [
        ExerciseAlternativeOut(
            exercise=ExerciseOut.of(exercise), recommended=recommended, hint=hint
        )
        for exercise, recommended, hint in await service.alternatives(user_id, exercise_id, reason)
    ]


@router.post("/exercises/suggest-category", response_model=CategorySuggestionOut)
async def suggest_category(
    payload: SuggestionIn, user_id: CurrentUserId, service: Decisions
) -> CategorySuggestionOut:
    return CategorySuggestionOut.of(await service.exercise_category(payload.subject))


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
            body_region=payload.body_region,
            equipment=payload.equipment,
            location=payload.location,
        )
    )


@router.patch("/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def edit_exercise(
    exercise_id: str, payload: ExerciseIn, user_id: CurrentUserId, service: Training
) -> None:
    await service.edit_exercise(
        user_id,
        exercise_id,
        category_id=payload.category_id,
        name=payload.name,
        description=payload.description,
        body_region=payload.body_region,
        equipment=payload.equipment,
        location=payload.location,
    )


@router.delete("/exercises/{exercise_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_exercise(exercise_id: str, user_id: CurrentUserId, service: Training) -> None:
    await service.remove_exercise(user_id, exercise_id)


@router.get("/workout-templates", response_model=list[TemplateOut])
async def list_templates(
    user_id: CurrentUserId, service: Training, location: str | None = None
) -> list[TemplateOut]:
    return [TemplateOut.of(t) for t in await service.templates(user_id, location)]


@router.post("/workout-templates", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    payload: TemplateIn, user_id: CurrentUserId, service: Training
) -> TemplateOut:
    saved = await service.save_template(user_id, _to_template(new_id(), payload))
    return TemplateOut.of(await service.template(user_id, saved.id))


@router.get("/workout-templates/{template_id}", response_model=TemplateOut)
async def read_template(template_id: str, user_id: CurrentUserId, service: Training) -> TemplateOut:
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


@router.put(
    "/workout-templates/{template_id}/items/{item_id}/weight",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def apply_template_item_weight(
    template_id: str,
    item_id: str,
    payload: TemplateWeightIn,
    user_id: CurrentUserId,
    service: WorkoutExecution,
) -> None:
    await service.apply_template_weight(user_id, template_id, item_id, payload.weight_kg)


@router.get("/workout-schedule", response_model=list[ScheduleEntryOut])
async def read_schedule(user_id: CurrentUserId, service: Training) -> list[ScheduleEntryOut]:
    return [ScheduleEntryOut.of(e) for e in await service.schedule(user_id)]


@router.put("/workout-schedule", response_model=list[ScheduleEntryOut])
async def set_schedule(
    payload: list[ScheduleEntryIn], user_id: CurrentUserId, service: Training
) -> list[ScheduleEntryOut]:
    entries = tuple(
        ScheduleEntry(weekday=e.weekday, template_id=e.template_id) for e in payload
    )
    return [ScheduleEntryOut.of(e) for e in await service.set_schedule(user_id, entries)]


def _to_template(template_id: str, payload: TemplateIn) -> WorkoutTemplate:
    return WorkoutTemplate(
        id=template_id,
        category_id=payload.category_id,
        name=payload.name,
        # Replaced by save_template, which reads it off the exercises' equipment.
        location=Location.HOME.value,
        duration_min=payload.duration_min,
        items=tuple(
            TemplateItem(
                id=item.id or new_id(),
                exercise_id=item.exercise_id,
                exercise_name="",
                sort_order=index,
                sets=item.sets,
                reps=item.reps,
                duration_sec=item.duration_sec,
                weight_kg=item.weight_kg,
                rest_sec=item.rest_sec,
                note=item.note,
            )
            for index, item in enumerate(payload.items)
        ),
    )
