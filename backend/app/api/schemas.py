"""Request and response shapes for HTTP.

Deliberately separate from the domain models, so changing the API never touches the rules.
"""

from dataclasses import fields
from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field

from app.application.accounts import TokenPair
from app.application.daily_flow import TodayView
from app.domain.meals import total
from app.domain.models import (
    BodyLog,
    BodySummary,
    DayFlow,
    DayPlan,
    Exchange,
    Exercise,
    Food,
    FoodCategory,
    Meal,
    MealItem,
    Nutrients,
    PlannedMeal,
    Profile,
    ScheduleEntry,
    Targets,
    TemplateItem,
    WorkoutTemplate,
)


def _values(obj: Any) -> dict[str, Any]:
    """Flatten a dataclass into a dict. Not recursive — nested dataclasses convert themselves."""
    return {f.name: getattr(obj, f.name) for f in fields(obj)}


class TokenPairOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"

    @classmethod
    def of(cls, pair: TokenPair) -> "TokenPairOut":
        return cls(access_token=pair.access_token, refresh_token=pair.refresh_token)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    locale: str = "zh-TW"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class ProviderLoginIn(BaseModel):
    id_token: str


class ProfileIn(BaseModel):
    sex: Literal["f", "m"]
    birth_date: date
    height_cm: float = Field(ge=100, le=250)
    weight_kg: float = Field(ge=30, le=300)
    activity_level: Literal["sedentary", "light", "moderate", "active"]
    deficit_pct: Literal[10, 12, 15, 20]
    auto_scale_carbs: bool = True
    auto_assign_meals: bool = True
    workout_time: Literal["am", "pm"] = "pm"
    default_location: Literal["home", "gym"] = "home"
    reminder_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    timezone: str = "Australia/Brisbane"


class ProfilePatch(BaseModel):
    sex: Literal["f", "m"] | None = None
    birth_date: date | None = None
    height_cm: float | None = Field(default=None, ge=100, le=250)
    weight_kg: float | None = Field(default=None, ge=30, le=300)
    activity_level: Literal["sedentary", "light", "moderate", "active"] | None = None
    deficit_pct: Literal[10, 12, 15, 20] | None = None
    auto_scale_carbs: bool | None = None
    auto_assign_meals: bool | None = None
    workout_time: Literal["am", "pm"] | None = None
    default_location: Literal["home", "gym"] | None = None


class RemindersPatch(BaseModel):
    reminder_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    timezone: str | None = None


class TargetsOut(BaseModel):
    bmr: int
    tdee: int
    kcal: int
    protein_g: int
    fat_g: int
    carb_g: int
    carb_scale: float

    @classmethod
    def of(cls, targets: Targets) -> "TargetsOut":
        return cls(**_values(targets))


class ProfileOut(BaseModel):
    sex: str
    birth_date: date
    height_cm: float
    weight_kg: float
    activity_level: str
    deficit_pct: int
    auto_scale_carbs: bool
    auto_assign_meals: bool
    workout_time: str
    default_location: str
    reminder_time: str | None
    timezone: str

    @classmethod
    def of(cls, profile: Profile) -> "ProfileOut":
        data = {k: v for k, v in _values(profile).items() if k in cls.model_fields}
        return cls(**data)


class ProfileWithTargetsOut(BaseModel):
    profile: ProfileOut
    targets: TargetsOut


class BodyLogIn(BaseModel):
    weight_kg: float | None = Field(default=None, ge=30, le=300)
    waist_cm: float | None = Field(default=None, ge=40, le=200)


class BodyLogOut(BaseModel):
    date: date
    weight_kg: float | None
    waist_cm: float | None

    @classmethod
    def of(cls, log: BodyLog) -> "BodyLogOut":
        return cls(date=log.date, weight_kg=log.weight_kg, waist_cm=log.waist_cm)


class TrendPointOut(BaseModel):
    date: date
    value: float
    average_7d: float | None


class BodySummaryOut(BaseModel):
    week_avg_weight: float | None
    week_avg_delta: float | None
    latest_waist: float | None
    weight_series: list[TrendPointOut]
    waist_series: list[TrendPointOut]

    @classmethod
    def of(cls, summary: BodySummary) -> "BodySummaryOut":
        return cls(
            week_avg_weight=summary.week_avg_weight,
            week_avg_delta=summary.week_avg_delta,
            latest_waist=summary.latest_waist,
            weight_series=[TrendPointOut(**_values(p)) for p in summary.weight_series],
            waist_series=[TrendPointOut(**_values(p)) for p in summary.waist_series],
        )


class DayFlowOut(BaseModel):
    steps: list[str]
    completed: list[str]
    current: str
    eaten_kcal: float

    @classmethod
    def of(cls, flow: DayFlow) -> "DayFlowOut":
        return cls(
            steps=[s.value for s in flow.steps],
            completed=[s.value for s in flow.steps if s in flow.completed],
            current=flow.current.value,
            eaten_kcal=flow.eaten_kcal,
        )


class TodayOut(BaseModel):
    date: date
    flow: DayFlowOut
    targets: TargetsOut
    streak: int

    @classmethod
    def of(cls, view: TodayView) -> "TodayOut":
        return cls(
            date=view.date,
            flow=DayFlowOut.of(view.flow),
            targets=TargetsOut.of(view.targets),
            streak=view.streak,
        )


class DayPatch(BaseModel):
    workout_time: Literal["am", "pm"] | None = None
    location: Literal["home", "gym"] | None = None
    steps: int | None = Field(default=None, ge=0)
    workout_done: bool = False


class SetLogIn(BaseModel):
    template_item_id: str
    exercise_id: str
    set_index: int = Field(ge=0)
    reps_done: int | None = Field(default=None, ge=0)
    weight_kg: float | None = Field(default=None, ge=0)


class ExerciseIn(BaseModel):
    category_id: str
    name: str
    description: str | None = None


class ExerciseOut(BaseModel):
    id: str
    category_id: str
    name: str
    description: str | None
    is_builtin: bool

    @classmethod
    def of(cls, exercise: Exercise) -> "ExerciseOut":
        return cls(**_values(exercise))


class TemplateItemIn(BaseModel):
    id: str | None = None
    exercise_id: str
    sets: int | None = Field(default=None, ge=1, le=10)
    reps: str
    weight_kg: float | None = Field(default=None, ge=0)
    rest_sec: int = 60
    note: str | None = None


class TemplateItemOut(BaseModel):
    id: str
    exercise_id: str
    exercise_name: str
    sort_order: int
    sets: int | None
    reps: str
    weight_kg: float | None
    rest_sec: int
    note: str | None

    @classmethod
    def of(cls, item: TemplateItem) -> "TemplateItemOut":
        return cls(**_values(item))


class TemplateIn(BaseModel):
    category_id: str
    name: str
    location: Literal["home", "gym", "both"]
    duration_min: int | None = Field(default=None, ge=0, le=240)
    items: list[TemplateItemIn] = Field(default_factory=list)


class TemplateOut(BaseModel):
    id: str
    category_id: str
    name: str
    location: str
    duration_min: int | None
    items: list[TemplateItemOut]

    @classmethod
    def of(cls, template: WorkoutTemplate) -> "TemplateOut":
        return cls(
            id=template.id,
            category_id=template.category_id,
            name=template.name,
            location=template.location,
            duration_min=template.duration_min,
            items=[TemplateItemOut.of(i) for i in template.items],
        )


class ItemOrderIn(BaseModel):
    item_ids: list[str]


class ScheduleEntryIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    location: Literal["home", "gym"]
    template_id: str


class ScheduleEntryOut(BaseModel):
    weekday: int
    location: str
    template_id: str

    @classmethod
    def of(cls, entry: ScheduleEntry) -> "ScheduleEntryOut":
        return cls(
            weekday=entry.weekday,
            location=entry.location.value,
            template_id=entry.template_id,
        )


class DeviceIn(BaseModel):
    push_token: str
    platform: Literal["ios", "android"]


class NutrientsOut(BaseModel):
    kcal: float
    protein_g: float
    fat_g: float
    carb_g: float

    @classmethod
    def of(cls, nutrients: Nutrients) -> "NutrientsOut":
        return cls(**_values(nutrients.rounded()))


class FoodCategoryOut(BaseModel):
    id: str
    name: str
    swap_by: str
    sort_order: int

    @classmethod
    def of(cls, category: FoodCategory) -> "FoodCategoryOut":
        return cls(
            id=category.id,
            name=category.name,
            swap_by=category.swap_by.value,
            sort_order=category.sort_order,
        )


class FoodOut(BaseModel):
    id: str
    category_id: str
    name: str
    state: str
    per_100g: NutrientsOut
    unit: str
    grams_per_unit: float | None
    usual_grams: float
    max_grams: float
    aliases: list[str]
    is_builtin: bool

    @classmethod
    def of(cls, food: Food) -> "FoodOut":
        return cls(
            id=food.id,
            category_id=food.category_id,
            name=food.name,
            state=food.state.value,
            per_100g=NutrientsOut.of(food.per_100g),
            unit=food.unit,
            grams_per_unit=food.grams_per_unit,
            usual_grams=food.usual_grams,
            max_grams=food.max_grams,
            aliases=list(food.aliases),
            is_builtin=food.is_builtin,
        )


class FoodIn(BaseModel):
    category_id: str
    name: str
    state: Literal["raw", "cooked", "na"] = "na"
    kcal_per_100g: float = Field(ge=0)
    protein_per_100g: float = Field(ge=0)
    fat_per_100g: float = Field(ge=0)
    carb_per_100g: float = Field(ge=0)
    unit: Literal["g", "ml", "piece", "scoop", "bowl"] = "g"
    grams_per_unit: float | None = Field(default=None, gt=0)
    usual_grams: float = Field(gt=0)
    max_grams: float = Field(gt=0)


class ExchangeOut(BaseModel):
    food: FoodOut
    grams: float
    nutrients: NutrientsOut
    delta: NutrientsOut
    capped: bool

    @classmethod
    def of(cls, exchange: Exchange) -> "ExchangeOut":
        return cls(
            food=FoodOut.of(exchange.food),
            grams=exchange.grams,
            nutrients=NutrientsOut.of(exchange.nutrients),
            delta=NutrientsOut.of(exchange.delta),
            capped=exchange.capped,
        )


class MealItemOut(BaseModel):
    id: str
    food: FoodOut
    category_id: str
    grams: float
    nutrients: NutrientsOut

    @classmethod
    def of(cls, item: MealItem) -> "MealItemOut":
        return cls(
            id=item.id,
            food=FoodOut.of(item.food),
            category_id=item.category_id,
            grams=item.grams,
            nutrients=NutrientsOut.of(item.nutrients),
        )


class MealItemIn(BaseModel):
    food_id: str
    grams: float = Field(gt=0)


class MealOut(BaseModel):
    id: str
    name: str
    tag: str
    meal_times: list[str]
    items: list[MealItemOut]
    nutrients: NutrientsOut

    @classmethod
    def of(cls, meal: Meal) -> "MealOut":
        return cls(
            id=meal.id,
            name=meal.name,
            tag=meal.tag.value,
            meal_times=sorted(slot.value for slot in meal.meal_times),
            items=[MealItemOut.of(i) for i in meal.items],
            nutrients=NutrientsOut.of(total(meal.items)),
        )


class MealIn(BaseModel):
    name: str
    tag: Literal["regular", "light", "occasional"] = "regular"
    meal_times: list[Literal["breakfast", "lunch", "dinner"]]
    items: list[MealItemIn]


class MealPatch(BaseModel):
    name: str | None = None
    tag: Literal["regular", "light", "occasional"] | None = None
    meal_times: list[Literal["breakfast", "lunch", "dinner"]] | None = None
    items: list[MealItemIn] | None = None


class CalculateIn(BaseModel):
    items: list[MealItemIn]


class PlannedMealOut(BaseModel):
    meal_time: str
    meal_id: str | None
    name: str
    eaten: bool
    items: list[MealItemOut]
    nutrients: NutrientsOut

    @classmethod
    def of(cls, planned: PlannedMeal) -> "PlannedMealOut":
        return cls(
            meal_time=planned.meal_time.value,
            meal_id=planned.meal_id,
            name=planned.name,
            eaten=planned.eaten,
            items=[MealItemOut.of(i) for i in planned.items],
            nutrients=NutrientsOut.of(total(planned.items)),
        )


class DayPlanOut(BaseModel):
    date: date
    meals: list[PlannedMealOut]
    nutrients: NutrientsOut

    @classmethod
    def of(cls, plan: DayPlan) -> "DayPlanOut":
        every_item = tuple(i for m in plan.meals for i in m.items)
        return cls(
            date=plan.date,
            meals=[PlannedMealOut.of(m) for m in plan.meals],
            nutrients=NutrientsOut.of(total(every_item)),
        )


class ShuffleIn(BaseModel):
    meal_time: Literal["breakfast", "lunch", "dinner"] | None = None


class SwapItemIn(BaseModel):
    item_id: str
    to_food_id: str
    match: Literal["carb", "protein", "kcal"] | None = None
