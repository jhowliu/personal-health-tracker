"""Request and response shapes for HTTP.

Deliberately separate from the domain models, so changing the API never touches the rules.
"""

from dataclasses import fields
from datetime import date
from typing import Annotated, Any, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator, BaseModel, EmailStr, Field, model_validator

from app.application.accounts import TokenPair
from app.application.daily_flow import TodayView
from app.domain.meal_photos import MealPhoto, RecognizedItem
from app.domain.meals import planned_total, total
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
    PlateItem,
    Profile,
    ScheduleEntry,
    Targets,
    TemplateItem,
    WorkoutTemplate,
)
from app.domain.progress import CalendarMonth, WeeklyReview
from app.domain.workout_execution import (
    DayWorkoutItem,
    PastSet,
    SetLog,
    WorkoutExecution,
    WorkoutExecutionItem,
)

PlannedSlot = Literal["breakfast", "lunch", "dinner"]
"""The wire form of `PLANNED_SLOTS`; a Literal so OpenAPI lists the allowed values."""


def _known_timezone(name: str) -> str:
    """An IANA name the server can compute a local date in; anything else would break every
    screen that asks what day it is.
    """
    try:
        ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, OSError) as e:
        raise ValueError("不認得這個時區,請用 Asia/Taipei 這樣的名稱") from e
    return name


Timezone = Annotated[str, AfterValidator(_known_timezone)]


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
    workout_time: Literal["am", "pm"] = "pm"
    default_location: Literal["home", "gym"] = "home"
    reminder_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    timezone: Timezone = "Australia/Brisbane"


class ProfilePatch(BaseModel):
    sex: Literal["f", "m"] | None = None
    birth_date: date | None = None
    height_cm: float | None = Field(default=None, ge=100, le=250)
    weight_kg: float | None = Field(default=None, ge=30, le=300)
    activity_level: Literal["sedentary", "light", "moderate", "active"] | None = None
    deficit_pct: Literal[10, 12, 15, 20] | None = None
    workout_time: Literal["am", "pm"] | None = None
    default_location: Literal["home", "gym"] | None = None
    timezone: Timezone | None = None


class RemindersPatch(BaseModel):
    reminder_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")


class TargetsOut(BaseModel):
    bmr: int
    tdee: int
    base_kcal: int
    exercise_kcal: int
    kcal: int
    protein_g: int
    fat_g: int
    carb_g: int

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


class CalendarDayOut(BaseModel):
    date: date
    mark: Literal["complete", "empty"]
    workout: Literal["done", "skipped"] | None


class CalendarMonthOut(BaseModel):
    """Every day of one month, for the calendar on 進度."""

    month: str  # "2026-10"
    today: date
    days: list[CalendarDayOut]

    @classmethod
    def of(cls, month: CalendarMonth) -> "CalendarMonthOut":
        return cls(
            month=month.month.strftime("%Y-%m"),
            today=month.today,
            days=[
                CalendarDayOut(
                    date=day.date,
                    mark=day.mark.value,
                    workout=day.workout.value if day.workout else None,
                )
                for day in month.days
            ],
        )


class WeeklyReviewOut(BaseModel):
    """A week on 進度 in a few numbers; the AI review reads the detail behind them."""

    start: date
    end: date
    weight_average: float | None
    weight_change: float | None
    waist_latest: float | None
    waist_change: float | None
    days_complete: int
    workouts: int
    volume_kg: float
    previous_volume_kg: float

    @classmethod
    def of(cls, review: WeeklyReview) -> "WeeklyReviewOut":
        return cls(**_values(review))


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
    waiting: list[str]
    current: str
    eaten: "NutrientsOut"
    # Completed steps that were skipped rather than done.
    skipped: list[str]

    @classmethod
    def of(cls, flow: DayFlow) -> "DayFlowOut":
        return cls(
            steps=[s.value for s in flow.steps],
            completed=[s.value for s in flow.steps if s in flow.completed],
            waiting=[s.value for s in flow.waiting],
            current=flow.current.value,
            eaten=NutrientsOut.of(flow.eaten),
            skipped=[s.value for s in flow.steps if s in flow.skipped],
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
    workout_done: bool = False
    workout_skipped: bool = False
    # A focus session's clocked seconds, added to the day's total.
    trained_sec: int | None = Field(default=None, gt=0, le=6 * 3600)


class MealStateIn(BaseModel):
    state: Literal["eaten", "skipped", "planned"] = "eaten"


class SetLogIn(BaseModel):
    day_workout_item_id: str
    exercise_id: str
    set_index: int = Field(ge=0)
    reps_done: int | None = Field(default=None, ge=0)
    duration_sec: int | None = Field(default=None, gt=0)
    weight_kg: float | None = Field(default=None, ge=0)
    effort: Literal["easy", "appropriate", "hard"] | None = None
    speed_kmh: float | None = Field(default=None, gt=0, le=30)
    incline_pct: float | None = Field(default=None, ge=0, le=40)


class SetRecordIn(BaseModel):
    reps_done: int | None = Field(default=None, ge=0)
    duration_sec: int | None = Field(default=None, gt=0)
    weight_kg: float | None = Field(default=None, ge=0)
    effort: Literal["easy", "appropriate", "hard"] | None = None
    speed_kmh: float | None = Field(default=None, gt=0, le=30)
    incline_pct: float | None = Field(default=None, ge=0, le=40)


class SetRecordsIn(BaseModel):
    """An exercise's whole record for the day, in order; a set left out is deleted."""

    sets: list[SetRecordIn] = Field(max_length=30)


class SetLogOut(BaseModel):
    day_workout_item_id: str
    exercise_id: str
    set_index: int
    reps_done: int | None
    duration_sec: int | None
    weight_kg: float | None
    effort: str | None
    done_at: str
    speed_kmh: float | None
    incline_pct: float | None

    @classmethod
    def of(cls, log: SetLog) -> "SetLogOut":
        return cls(
            day_workout_item_id=log.day_workout_item_id,
            exercise_id=log.exercise_id,
            set_index=log.set_index,
            reps_done=log.reps_done,
            duration_sec=log.duration_sec,
            weight_kg=log.weight_kg,
            effort=log.effort.value if log.effort else None,
            done_at=log.done_at.isoformat(),
            speed_kmh=log.speed_kmh,
            incline_pct=log.incline_pct,
        )


class SetLogResultOut(BaseModel):
    today: TodayOut
    next_weight_kg: float | None


class ExerciseIn(BaseModel):
    category_id: str
    name: str
    description: str | None = None
    body_region: Literal["lower_body", "upper_body", "core", "full_body", "mobility"] | None = None
    equipment: (
        Literal[
            "bodyweight",
            "machine",
            "barbell",
            "dumbbell",
            "kettlebell",
            "cable",
            "resistance_band",
            "treadmill",
        ]
        | None
    ) = None
    location: Literal["home", "gym", "both"] | None = None


class ExerciseOut(BaseModel):
    id: str
    category_id: str
    name: str
    description: str | None
    body_region: str | None
    equipment: str | None
    location: str | None
    # Built-ins only. Feeds the displayed burn estimate, never the calorie target.
    met: float | None
    is_builtin: bool

    @classmethod
    def of(cls, exercise: Exercise) -> "ExerciseOut":
        return cls(**_values(exercise))


class ExerciseAlternativeOut(BaseModel):
    exercise: ExerciseOut
    recommended: bool
    hint: str


# A count or a range of them: 12, 10-12; built-in templates write the range with an en dash.
REPS_PATTERN = r"^\d+(\s*[-–~]\s*\d+)?$"


class TemplateItemIn(BaseModel):
    id: str | None = None
    exercise_id: str
    sets: int | None = Field(default=None, ge=1, le=10)
    reps: str | None = Field(default=None, pattern=REPS_PATTERN)
    duration_sec: int | None = Field(default=None, gt=0)
    weight_kg: float | None = Field(default=None, ge=0)
    rest_sec: int = 60
    note: str | None = None

    @model_validator(mode="after")
    def _counted_or_timed(self) -> "TemplateItemIn":
        if self.reps is None and self.duration_sec is None:
            raise ValueError("動作需要次數或時間")
        return self


class TemplateItemOut(BaseModel):
    id: str
    exercise_id: str
    exercise_name: str
    sort_order: int
    sets: int | None
    reps: str | None
    duration_sec: int | None
    weight_kg: float | None
    rest_sec: int
    note: str | None

    @classmethod
    def of(cls, item: TemplateItem) -> "TemplateItemOut":
        return cls(**_values(item))


class TemplateIn(BaseModel):
    category_id: str
    name: str
    duration_min: int | None = Field(default=None, ge=0, le=240)
    items: list[TemplateItemIn] = Field(default_factory=list)


class TemplateOut(BaseModel):
    id: str
    category_id: str
    name: str
    location: str
    duration_min: int | None
    is_builtin: bool
    items: list[TemplateItemOut]

    @classmethod
    def of(cls, template: WorkoutTemplate) -> "TemplateOut":
        return cls(
            id=template.id,
            category_id=template.category_id,
            name=template.name,
            location=template.location,
            duration_min=template.duration_min,
            is_builtin=template.is_builtin,
            items=[TemplateItemOut.of(i) for i in template.items],
        )


class WorkoutOrderIn(BaseModel):
    """Every exercise on the day, once each, in the order they should be done."""

    item_ids: list[str] = Field(min_length=1)


class SaveDayTemplateIn(BaseModel):
    name: str = Field(min_length=1)


class WorkoutItemIn(BaseModel):
    exercise_id: str
    sets: int | None = Field(default=None, ge=1, le=10)
    reps: str | None = Field(default=None, pattern=REPS_PATTERN)
    duration_sec: int | None = Field(default=None, gt=0)
    weight_kg: float | None = Field(default=None, ge=0)
    rest_sec: int = Field(default=60, ge=0)
    note: str | None = None

    @model_validator(mode="after")
    def _exactly_one_prescription(self) -> "WorkoutItemIn":
        if (self.reps is None) == (self.duration_sec is None):
            raise ValueError("動作需要次數或時間，但不能同時提供")
        return self


class WorkoutItemPatch(BaseModel):
    exercise_id: str | None = None
    replacement_reason: Literal[
        "equipment_occupied", "knee_discomfort", "missing_equipment", "variety"
    ] | None = None
    sets: int | None = Field(default=None, ge=1, le=10)
    reps: str | None = Field(default=None, pattern=REPS_PATTERN)
    duration_sec: int | None = Field(default=None, gt=0)
    weight_kg: float | None = Field(default=None, ge=0)
    rest_sec: int | None = Field(default=None, ge=0)
    note: str | None = None


class DayWorkoutItemOut(BaseModel):
    id: str
    exercise_id: str
    exercise_name: str
    sort_order: int
    sets: int | None
    reps: str | None
    duration_sec: int | None
    weight_kg: float | None
    rest_sec: int
    note: str | None
    met: float | None
    replaced_exercise_name: str | None
    replacement_reason: str | None
    source_item_id: str | None
    equipment: str | None

    @classmethod
    def of(cls, item: DayWorkoutItem) -> "DayWorkoutItemOut":
        values = _values(item)
        reason = values["replacement_reason"]
        return cls(**{**values, "replacement_reason": reason.value if reason else None})


class PastSetOut(BaseModel):
    date: date
    weight_kg: float | None
    reps_done: int | None
    duration_sec: int | None
    effort: str | None
    speed_kmh: float | None
    incline_pct: float | None

    @classmethod
    def of(cls, past: PastSet) -> "PastSetOut":
        return cls(
            date=past.date,
            weight_kg=past.weight_kg,
            reps_done=past.reps_done,
            duration_sec=past.duration_sec,
            effort=past.effort.value if past.effort else None,
            speed_kmh=past.speed_kmh,
            incline_pct=past.incline_pct,
        )


class WorkoutExecutionItemOut(BaseModel):
    item: DayWorkoutItemOut
    completed_set_count: int
    logs: list[SetLogOut]
    # From earlier days: where focus mode starts this exercise, and the weight to beat.
    last_set: PastSetOut | None
    best_weight_kg: float | None
    suggested_weight_kg: float | None

    @classmethod
    def of(cls, entry: WorkoutExecutionItem) -> "WorkoutExecutionItemOut":
        last = entry.history.last_set
        return cls(
            item=DayWorkoutItemOut.of(entry.item),
            completed_set_count=entry.completed_set_count,
            logs=[SetLogOut.of(log) for log in entry.logs],
            last_set=PastSetOut.of(last) if last else None,
            best_weight_kg=entry.history.best_weight_kg,
            suggested_weight_kg=entry.history.suggested_weight_kg,
        )


class WorkoutTemplateMetaOut(BaseModel):
    id: str
    category_id: str
    name: str
    location: str
    duration_min: int | None
    is_builtin: bool

    @classmethod
    def of(cls, template: WorkoutTemplate) -> "WorkoutTemplateMetaOut":
        return cls(
            id=template.id,
            category_id=template.category_id,
            name=template.name,
            location=template.location,
            duration_min=template.duration_min,
            is_builtin=template.is_builtin,
        )


class WorkoutExecutionOut(BaseModel):
    date: date
    template: WorkoutTemplateMetaOut | None
    items: list[WorkoutExecutionItemOut]
    # A rough figure for the screen. Null until there is enough logged to estimate.
    estimated_burn_kcal: int | None

    @classmethod
    def of(cls, workout: WorkoutExecution) -> "WorkoutExecutionOut":
        return cls(
            date=workout.date,
            template=WorkoutTemplateMetaOut.of(workout.template) if workout.template else None,
            items=[WorkoutExecutionItemOut.of(item) for item in workout.items],
            estimated_burn_kcal=workout.estimated_burn_kcal,
        )



class ScheduleEntryIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    template_id: str


class ScheduleEntryOut(BaseModel):
    weekday: int
    template_id: str

    @classmethod
    def of(cls, entry: ScheduleEntry) -> "ScheduleEntryOut":
        return cls(weekday=entry.weekday, template_id=entry.template_id)


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


class NutrientsIn(BaseModel):
    kcal: float = Field(ge=0)
    protein_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)
    carb_g: float = Field(ge=0)

    def to_domain(self) -> Nutrients:
        return Nutrients(**self.model_dump())


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
    fiber_per_100g: float | None
    unit: str
    grams_per_unit: float | None
    usual_grams: float
    max_grams: float
    aliases: list[str]
    template_id: str | None

    @classmethod
    def of(cls, food: Food) -> "FoodOut":
        return cls(
            id=food.id,
            category_id=food.category_id,
            name=food.name,
            state=food.state.value,
            per_100g=NutrientsOut.of(food.per_100g),
            fiber_per_100g=food.fiber_per_100g,
            unit=food.unit,
            grams_per_unit=food.grams_per_unit,
            usual_grams=food.usual_grams,
            max_grams=food.max_grams,
            aliases=list(food.aliases),
            template_id=food.template_id,
        )


class FoodIn(BaseModel):
    category_id: str
    name: str
    state: Literal["raw", "cooked", "na"] = "na"
    kcal_per_100g: float = Field(ge=0)
    protein_per_100g: float = Field(ge=0)
    fat_per_100g: float = Field(ge=0)
    carb_per_100g: float = Field(ge=0)
    fiber_per_100g: float | None = Field(default=None, ge=0)
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
    meal_times: list[str]
    items: list[MealItemOut]
    nutrients: NutrientsOut

    @classmethod
    def of(cls, meal: Meal) -> "MealOut":
        return cls(
            id=meal.id,
            name=meal.name,
            meal_times=sorted(slot.value for slot in meal.meal_times),
            items=[MealItemOut.of(i) for i in meal.items],
            nutrients=NutrientsOut.of(total(meal.items)),
        )


class MealIn(BaseModel):
    name: str
    meal_times: list[PlannedSlot]
    items: list[MealItemIn]


class MealPatch(BaseModel):
    name: str | None = None
    meal_times: list[PlannedSlot] | None = None
    items: list[MealItemIn] | None = None


class CalculateIn(BaseModel):
    items: list[MealItemIn]


class PlannedMealOut(BaseModel):
    meal_time: str
    meal_id: str | None
    name: str
    eaten: bool
    skipped: bool
    items: list["PlannedMealItemOut"]
    nutrients: NutrientsOut

    @classmethod
    def of(cls, planned: PlannedMeal) -> "PlannedMealOut":
        return cls(
            meal_time=planned.meal_time.value,
            meal_id=planned.meal_id,
            name=planned.name,
            eaten=planned.eaten,
            skipped=planned.skipped,
            items=[PlannedMealItemOut.of(i) for i in planned.items],
            nutrients=NutrientsOut.of(total(planned.items)),
        )


class PlannedMealItemOut(BaseModel):
    id: str
    food: FoodOut | None
    category_id: str | None
    custom_name: str | None
    grams: float | None
    nutrients: NutrientsOut
    photo_id: str | None

    @classmethod
    def of(cls, item: PlateItem) -> "PlannedMealItemOut":
        return cls(
            id=item.id,
            food=FoodOut.of(item.food) if item.food else None,
            category_id=item.category_id,
            custom_name=item.custom_name,
            grams=item.grams,
            nutrients=NutrientsOut.of(item.nutrients),
            photo_id=item.photo_id,
        )


class DayPlanOut(BaseModel):
    date: date
    meals: list[PlannedMealOut]
    extras: list["ExtraItemOut"]
    nutrients: NutrientsOut

    @classmethod
    def of(cls, plan: DayPlan) -> "DayPlanOut":
        return cls(
            date=plan.date,
            meals=[PlannedMealOut.of(m) for m in plan.meals],
            extras=[ExtraItemOut.of(extra) for extra in plan.extras],
            nutrients=NutrientsOut.of(planned_total(plan)),
        )


class PlanMealIn(BaseModel):
    meal_id: str


class SwapItemIn(BaseModel):
    item_id: str
    to_food_id: str
    match: Literal["carb", "protein", "kcal"] | None = None


class PlanItemPatchIn(BaseModel):
    grams: float = Field(gt=0)


class MealPhotoCreateIn(BaseModel):
    content_type: Literal["image/jpeg", "image/png"]


class MealPhotoCreateOut(BaseModel):
    id: str
    object_key: str
    upload_url: str
    status: str

    @classmethod
    def of(cls, photo: MealPhoto, upload_url: str) -> "MealPhotoCreateOut":
        return cls(
            id=photo.id,
            object_key=photo.object_key,
            upload_url=upload_url,
            status=photo.status.value,
        )


class RecognizedFoodOut(BaseModel):
    food_id: str
    category_id: str
    label: str


class EstimatedFoodOut(BaseModel):
    category_id: str
    kcal_per_100g: float
    protein_per_100g: float
    fat_per_100g: float
    carb_per_100g: float


class RecognizedItemOut(BaseModel):
    label: str
    category_id: str | None
    food_id: str | None
    grams: float
    recognition_confidence: float
    match_confidence: float
    alternatives: list[RecognizedFoodOut]
    estimate: EstimatedFoodOut | None

    @classmethod
    def of(cls, item: RecognizedItem) -> "RecognizedItemOut":
        return cls(
            label=item.label,
            category_id=item.category_id,
            food_id=item.food_id,
            grams=item.grams,
            recognition_confidence=item.recognition_confidence,
            match_confidence=item.match_confidence,
            alternatives=[RecognizedFoodOut(**_values(option)) for option in item.alternatives],
            estimate=(
                EstimatedFoodOut(
                    category_id=item.estimate.category_id,
                    kcal_per_100g=item.estimate.per_100g.kcal,
                    protein_per_100g=item.estimate.per_100g.protein_g,
                    fat_per_100g=item.estimate.per_100g.fat_g,
                    carb_per_100g=item.estimate.per_100g.carb_g,
                )
                if item.estimate
                else None
            ),
        )


class MealPhotoAnalysisOut(BaseModel):
    id: str
    status: str
    items: list[RecognizedItemOut]


class ExtraItemIn(BaseModel):
    food_id: str | None = None
    grams: float | None = Field(default=None, gt=0)
    custom_name: str | None = Field(default=None, min_length=1, max_length=120)
    nutrients: NutrientsIn | None = None
    photo_id: str | None = None

    @model_validator(mode="after")
    def known_or_custom(self) -> "ExtraItemIn":
        known = self.food_id is not None and self.grams is not None
        custom = self.custom_name is not None and self.nutrients is not None
        if known == custom:
            raise ValueError("提供 food_id 與 grams，或 custom_name 與 nutrients 其中一組")
        return self


class ExtraItemOut(BaseModel):
    id: str
    # What to list it by: the food's name, or the one typed in for a custom item.
    name: str
    food_id: str | None
    custom_name: str | None
    grams: float | None
    nutrients: NutrientsOut
    photo_id: str | None

    @classmethod
    def of(cls, item: PlateItem) -> "ExtraItemOut":
        return cls(
            id=item.id,
            name=item.food.name if item.food else item.custom_name or "",
            food_id=item.food_id,
            custom_name=item.custom_name,
            grams=item.grams,
            nutrients=NutrientsOut.of(item.nutrients),
            photo_id=item.photo_id,
        )



