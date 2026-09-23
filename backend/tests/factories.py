"""Builders for domain objects used across the pure-domain tests."""

from app.domain.models import (
    Food,
    FoodState,
    Meal,
    MealItem,
    MealTag,
    MealTime,
    Nutrients,
)


def food(
    id: str,
    category_id: str = "protein",
    *,
    kcal: float,
    protein: float = 0.0,
    fat: float = 0.0,
    carb: float = 0.0,
    usual_grams: float = 100.0,
    max_grams: float = 200.0,
    grams_per_unit: float | None = None,
    unit: str = "g",
    name: str | None = None,
) -> Food:
    return Food(
        id=id,
        category_id=category_id,
        name=name or id,
        state=FoodState.COOKED,
        per_100g=Nutrients(kcal=kcal, protein_g=protein, fat_g=fat, carb_g=carb),
        fiber_per_100g=None,
        unit=unit,
        grams_per_unit=grams_per_unit,
        usual_grams=usual_grams,
        max_grams=max_grams,
    )


def item(f: Food, grams: float, sort_order: int = 0) -> MealItem:
    return MealItem(id=f"{f.id}-item", food=f, grams=grams, sort_order=sort_order)


def meal(
    id: str,
    *items: MealItem,
    tag: MealTag = MealTag.REGULAR,
    times: tuple[MealTime, ...] = (MealTime.LUNCH, MealTime.DINNER),
    name: str | None = None,
) -> Meal:
    return Meal(
        id=id,
        name=name or id,
        tag=tag,
        meal_times=frozenset(times),
        items=items,
    )


# The spec's worked example: swapping chicken breast for boneless thigh.
CHICKEN_BREAST = food("chicken-breast", kcal=165, protein=31, fat=4, carb=0)
CHICKEN_THIGH = food("chicken-thigh", kcal=210, protein=24, fat=13, carb=0)
PORK_COLLAR = food("pork-collar", kcal=250, protein=25, fat=17, carb=0, usual_grams=80)
EGG = food("egg", kcal=156, protein=12, fat=10, carb=2, grams_per_unit=50, unit="piece",
           usual_grams=50, max_grams=150)
TOFU = food("tofu", kcal=70, protein=8, fat=4, carb=2, usual_grams=150, max_grams=200)

BROWN_RICE = food("brown-rice", "staple", kcal=110, protein=2, fat=1, carb=23,
                  usual_grams=120, max_grams=250)
BROCCOLI = food("broccoli", "vegetable", kcal=25, protein=3, fat=0, carb=5,
                usual_grams=150, max_grams=300)
