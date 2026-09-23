from fastapi import APIRouter, status

from app.api.deps import CurrentUserId, Foods
from app.api.schemas import ExchangeOut, FoodCategoryOut, FoodIn, FoodOut
from app.domain.models import Food, FoodState, Nutrients, SwapBasis

router = APIRouter(tags=["foods"])


@router.get("/food-categories", response_model=list[FoodCategoryOut])
async def list_categories(service: Foods) -> list[FoodCategoryOut]:
    return [FoodCategoryOut.of(c) for c in await service.categories()]


@router.get("/foods", response_model=list[FoodOut])
async def search_foods(
    user_id: CurrentUserId,
    service: Foods,
    q: str | None = None,
    category: str | None = None,
) -> list[FoodOut]:
    return [FoodOut.of(f) for f in await service.search(user_id, q, category)]


@router.post("/foods", response_model=FoodOut, status_code=status.HTTP_201_CREATED)
async def add_food(payload: FoodIn, user_id: CurrentUserId, service: Foods) -> FoodOut:
    return FoodOut.of(await service.add_custom(user_id, _to_food("", payload)))


@router.patch("/foods/{food_id}", response_model=FoodOut)
async def edit_food(
    food_id: str, payload: FoodIn, user_id: CurrentUserId, service: Foods
) -> FoodOut:
    await service.edit_custom(user_id, _to_food(food_id, payload))
    return FoodOut.of(await service.get(user_id, food_id))


@router.delete("/foods/{food_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_food(food_id: str, user_id: CurrentUserId, service: Foods) -> None:
    await service.remove_custom(user_id, food_id)


@router.get("/foods/{food_id}/exchanges", response_model=list[ExchangeOut])
async def list_exchanges(
    food_id: str,
    user_id: CurrentUserId,
    service: Foods,
    grams: float | None = None,
    match: str | None = None,
) -> list[ExchangeOut]:
    """Same-category swaps. `grams` defaults to the food's usual portion, `match` to
    the category's own rule.
    """
    source = await service.get(user_id, food_id)
    basis = SwapBasis(match) if match else None
    swaps = await service.exchanges(user_id, food_id, grams or source.usual_grams, basis)
    return [ExchangeOut.of(e) for e in swaps]


def _to_food(food_id: str, payload: FoodIn) -> Food:
    return Food(
        id=food_id,
        category_id=payload.category_id,
        name=payload.name,
        state=FoodState(payload.state),
        per_100g=Nutrients(
            kcal=payload.kcal_per_100g,
            protein_g=payload.protein_per_100g,
            fat_g=payload.fat_per_100g,
            carb_g=payload.carb_per_100g,
        ),
        fiber_per_100g=None,
        unit=payload.unit,
        grams_per_unit=payload.grams_per_unit,
        usual_grams=payload.usual_grams,
        max_grams=max(payload.max_grams, payload.usual_grams),
        is_builtin=False,
    )
