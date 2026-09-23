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
