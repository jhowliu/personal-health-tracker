from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum


class Sex(StrEnum):
    FEMALE = "f"
    MALE = "m"


class ActivityLevel(StrEnum):
    SEDENTARY = "sedentary"
    LIGHT = "light"
    MODERATE = "moderate"
    ACTIVE = "active"


class MealTime(StrEnum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    EXTRAS = "extras"


class WorkoutTime(StrEnum):
    AM = "am"
    PM = "pm"


class Location(StrEnum):
    HOME = "home"
    GYM = "gym"


class FlowStep(StrEnum):
    BODY = "body"
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    WORKOUT = "workout"
    DINNER = "dinner"
    DONE = "done"


class SwapBasis(StrEnum):
    """Which nutrient is held constant when swapping one food for another."""

    CARB = "carb"
    PROTEIN = "protein"
    KCAL = "kcal"
    NONE = "none"


class MealTag(StrEnum):
    REGULAR = "regular"
    LIGHT = "light"
    OCCASIONAL = "occasional"


class FoodState(StrEnum):
    RAW = "raw"
    COOKED = "cooked"
    NA = "na"


@dataclass(frozen=True, slots=True)
class Account:
    id: str
    email: str
    locale: str
    created_at: datetime


@dataclass(frozen=True, slots=True)
class Profile:
    user_id: str
    sex: Sex
    birth_date: date
    height_cm: float
    weight_kg: float
    activity_level: ActivityLevel
    deficit_pct: int
    carb_base_g: float
    auto_scale_carbs: bool
    auto_assign_meals: bool
    workout_time: WorkoutTime
    default_location: Location
    reminder_time: str | None
    timezone: str

    def age_on(self, today: date) -> int:
        years = today.year - self.birth_date.year
        if (today.month, today.day) < (self.birth_date.month, self.birth_date.day):
            years -= 1
        return years


@dataclass(frozen=True, slots=True)
class Targets:
    bmr: int
    tdee: int
    kcal: int
    protein_g: int
    fat_g: int
    carb_g: int
    carb_scale: float


@dataclass(frozen=True, slots=True)
class BodyLog:
    date: date
    weight_kg: float | None
    waist_cm: float | None


@dataclass(frozen=True, slots=True)
class TrendPoint:
    date: date
    value: float
    average_7d: float | None


@dataclass(frozen=True, slots=True)
class BodySummary:
    week_avg_weight: float | None
    week_avg_delta: float | None
    latest_waist: float | None
    weight_series: tuple[TrendPoint, ...]
    waist_series: tuple[TrendPoint, ...]


@dataclass(frozen=True, slots=True)
class MealSlot:
    meal_time: MealTime
    meal_id: str | None
    eaten_at: datetime | None
    kcal: float


@dataclass(frozen=True, slots=True)
class DayFacts:
    """Everything needed to derive today's flow, assembled by the application layer."""

    date: date
    body_logged: bool
    slots: tuple[MealSlot, ...]
    workout_time: WorkoutTime
    workout_done_at: datetime | None
    has_workout_planned: bool


@dataclass(frozen=True, slots=True)
class DayFlow:
    steps: tuple[FlowStep, ...]
    completed: frozenset[FlowStep]
    current: FlowStep
    eaten_kcal: float


@dataclass(frozen=True, slots=True)
class Exercise:
    id: str
    category_id: str
    name: str
    description: str | None
    is_builtin: bool


@dataclass(frozen=True, slots=True)
class TemplateItem:
    id: str
    exercise_id: str
    exercise_name: str
    sort_order: int
    sets: int | None
    reps: str
    weight_kg: float | None
    rest_sec: int
    note: str | None


@dataclass(frozen=True, slots=True)
class WorkoutTemplate:
    id: str
    category_id: str
    name: str
    location: str
    duration_min: int | None
    items: tuple[TemplateItem, ...]


@dataclass(frozen=True, slots=True)
class ScheduleEntry:
    weekday: int
    location: Location
    template_id: str


@dataclass(frozen=True, slots=True)
class Nutrients:
    kcal: float
    protein_g: float
    fat_g: float
    carb_g: float

    def __add__(self, other: "Nutrients") -> "Nutrients":
        return Nutrients(
            kcal=self.kcal + other.kcal,
            protein_g=self.protein_g + other.protein_g,
            fat_g=self.fat_g + other.fat_g,
            carb_g=self.carb_g + other.carb_g,
        )

    def rounded(self, places: int = 1) -> "Nutrients":
        return Nutrients(
            kcal=round(self.kcal, places),
            protein_g=round(self.protein_g, places),
            fat_g=round(self.fat_g, places),
            carb_g=round(self.carb_g, places),
        )


ZERO_NUTRIENTS = Nutrients(0.0, 0.0, 0.0, 0.0)


@dataclass(frozen=True, slots=True)
class FoodCategory:
    id: str
    name: str
    swap_by: SwapBasis
    sort_order: int


@dataclass(frozen=True, slots=True)
class Food:
    id: str
    category_id: str
    name: str
    state: FoodState
    per_100g: Nutrients
    fiber_per_100g: float | None
    unit: str
    grams_per_unit: float | None
    usual_grams: float
    max_grams: float
    aliases: tuple[str, ...] = ()
    is_builtin: bool = True

    def nutrients_for(self, grams: float) -> Nutrients:
        factor = grams / 100.0
        return Nutrients(
            kcal=self.per_100g.kcal * factor,
            protein_g=self.per_100g.protein_g * factor,
            fat_g=self.per_100g.fat_g * factor,
            carb_g=self.per_100g.carb_g * factor,
        )

    def amount_of(self, basis: SwapBasis) -> float:
        """How much of the swap nutrient sits in 100 g of this food."""
        return {
            SwapBasis.CARB: self.per_100g.carb_g,
            SwapBasis.PROTEIN: self.per_100g.protein_g,
            SwapBasis.KCAL: self.per_100g.kcal,
            SwapBasis.NONE: 0.0,
        }[basis]


@dataclass(frozen=True, slots=True)
class MealItem:
    """One food in a meal, at its baseline grams (before any carb_scale)."""

    id: str
    food: Food
    grams: float
    sort_order: int

    @property
    def category_id(self) -> str:
        return self.food.category_id

    @property
    def nutrients(self) -> Nutrients:
        return self.food.nutrients_for(self.grams)


@dataclass(frozen=True, slots=True)
class Meal:
    id: str
    name: str
    tag: MealTag
    meal_times: frozenset[MealTime]
    items: tuple[MealItem, ...]


@dataclass(frozen=True, slots=True)
class Exchange:
    """One candidate when swapping a food for another in the same category."""

    food: Food
    grams: float
    nutrients: Nutrients
    delta: Nutrients
    capped: bool

    @property
    def basis_matched(self) -> bool:
        """False when max_grams stopped us short of an equal swap."""
        return not self.capped
