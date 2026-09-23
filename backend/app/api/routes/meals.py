from fastapi import APIRouter, status

from app.api.deps import CurrentUserId, Meals
from app.api.schemas import CalculateIn, MealIn, MealOut, MealPatch, NutrientsOut
from app.domain.models import MealTag, MealTime

router = APIRouter(prefix="/meals", tags=["meals"])


@router.get("", response_model=list[MealOut])
async def list_meals(
    user_id: CurrentUserId,
    service: Meals,
    meal_time: str | None = None,
    q: str | None = None,
) -> list[MealOut]:
    slot = MealTime(meal_time) if meal_time else None
    return [MealOut.of(m) for m in await service.list(user_id, slot, q)]


@router.post("", response_model=MealOut, status_code=status.HTTP_201_CREATED)
async def create_meal(payload: MealIn, user_id: CurrentUserId, service: Meals) -> MealOut:
    meal = await service.create(
        user_id,
        name=payload.name,
        tag=MealTag(payload.tag),
        meal_times=frozenset(MealTime(t) for t in payload.meal_times),
        items=tuple((i.food_id, i.grams) for i in payload.items),
    )
    return MealOut.of(meal)


@router.post("/calculate", response_model=NutrientsOut)
async def calculate(
    payload: CalculateIn, user_id: CurrentUserId, service: Meals
) -> NutrientsOut:
    """Totals for a draft meal. Stores nothing — the edit screen calls this while typing."""
    items = tuple((i.food_id, i.grams) for i in payload.items)
    return NutrientsOut.of(await service.calculate(user_id, items))


@router.get("/{meal_id}", response_model=MealOut)
async def read_meal(meal_id: str, user_id: CurrentUserId, service: Meals) -> MealOut:
    return MealOut.of(await service.get(user_id, meal_id))


@router.patch("/{meal_id}", response_model=MealOut)
async def update_meal(
    meal_id: str, payload: MealPatch, user_id: CurrentUserId, service: Meals
) -> MealOut:
    meal = await service.update(
        user_id,
        meal_id,
        name=payload.name,
        tag=MealTag(payload.tag) if payload.tag else None,
        meal_times=(
            frozenset(MealTime(t) for t in payload.meal_times)
            if payload.meal_times is not None
            else None
        ),
        items=(
            tuple((i.food_id, i.grams) for i in payload.items)
            if payload.items is not None
            else None
        ),
    )
    return MealOut.of(meal)


@router.delete("/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_meal(meal_id: str, user_id: CurrentUserId, service: Meals) -> None:
    await service.remove(user_id, meal_id)
