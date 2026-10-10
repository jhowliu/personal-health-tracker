"""The weekly review with Claude: a week of logs in, a look back and next week's plan out."""

import logging

import anthropic
import httpx2
from pydantic import BaseModel, ConfigDict, Field

from app.domain.errors import ServiceUnavailable
from app.domain.models import MealTime, Nutrients
from app.domain.progress import WorkoutMark
from app.domain.weekly_advice import DayDigest, WeekDigest, WeeklyAdvice

log = logging.getLogger(__name__)

# A classifier decline is re-run server-side on the model Anthropic recommends for its
# category, instead of coming back as a refusal.
_FALLBACK_BETA = "server-side-fallback-2026-07-01"
# Two 45 s attempts stay inside the 100 s Cloudflare gives the request this runs in.
_TIMEOUT_S = 45.0

INSTRUCTIONS = """\
You review one week of a user's log in a fat-loss app: first how the week went, then what \
to do in the week ahead.

- summary: one or two sentences, at most 80 characters, on how the week went: what went \
well and the biggest gap, with the log's own numbers (days fully logged, protein against \
target, workouts, weight or waist change).
- diet: one thing to do next week about eating against the daily targets, protein first, \
then calories. Aim it at the days or meals that fell short or ran over.
- training: one thing to do next week about workouts, from those done and skipped and the \
training volume against the week before.
- body: one thing to do next week about weight and waist and the fat-loss goal. A week is \
short; read the direction, not single days.

diet, training and body are one sentence each, at most 40 characters, starting with what \
to do. Write in Traditional Chinese as used in Taiwan. Use the log's own days, meals and \
numbers rather than general tips. Be encouraging, not judgmental, and do not diagnose. A day \
marked "nothing logged" has no record, which is not the same as eating nothing; when a part \
has too little data, suggest what to log instead of guessing.\
"""

_MEAL = {
    MealTime.BREAKFAST: "breakfast",
    MealTime.LUNCH: "lunch",
    MealTime.DINNER: "dinner",
    MealTime.EXTRAS: "extras",
}
_WEEKDAY = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


class WeeklyAdviceOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=1, max_length=200)
    diet: str = Field(min_length=1, max_length=120)
    training: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=120)


def _food(n: Nutrients) -> str:
    return (
        f"{n.kcal:.0f} kcal, protein {n.protein_g:.0f} g, fat {n.fat_g:.0f} g, "
        f"carbs {n.carb_g:.0f} g"
    )


def _change(value: float | None, unit: str) -> str:
    return "no earlier figure" if value is None else f"{value:+.1f} {unit} vs before"


def _day(day: DayDigest) -> list[str]:
    lines = [f"{day.date} {_WEEKDAY[day.date.weekday()]}"]
    body = [
        f"weight {day.weight_kg:.1f} kg" if day.weight_kg is not None else None,
        f"waist {day.waist_cm:.1f} cm" if day.waist_cm is not None else None,
    ]
    if any(body):
        lines.append("  " + ", ".join(part for part in body if part))
    if day.targets is not None and day.eaten is not None:
        t = day.targets
        lines.append(
            f"  target {t.kcal} kcal, protein {t.protein_g} g, fat {t.fat_g} g, carbs {t.carb_g} g"
        )
        lines.append(f"  eaten {_food(day.eaten)}")
        meals = [
            f"{_MEAL[meal.meal_time]} {meal.state}"
            + (
                f" ({meal.nutrients.kcal:.0f} kcal, protein {meal.nutrients.protein_g:.0f} g)"
                if meal.state == "eaten"
                else ""
            )
            for meal in day.meals
        ]
        if meals:
            lines.append("  meals: " + "; ".join(meals))
    if day.workout is not None:
        done = "done" if day.workout is WorkoutMark.DONE else "skipped"
        exercises = [
            f"{e.name} {e.sets} sets"
            + (f", {e.reps} reps" if e.reps else "")
            + (f", top {e.top_weight_kg:g} kg" if e.top_weight_kg is not None else "")
            + (f", {e.minutes} min" if e.minutes else "")
            for e in day.exercises
        ]
        lines.append(f"  workout {done}" + (": " + "; ".join(exercises) if exercises else ""))
    if len(lines) == 1:
        lines.append("  nothing logged")
    return lines


def render(week: WeekDigest) -> str:
    """The week as plain lines, the shape the model reads best."""
    r = week.review
    sex = "female" if week.sex.value == "f" else "male"
    lines = [
        f"Week {r.start} to {r.end} (Monday to Sunday).",
        f"User: {sex}, {week.age} years, {week.height_cm:g} cm, activity "
        f"{week.activity_level.value}, eating at a {week.deficit_pct}% calorie deficit "
        "to lose fat.",
        "Week in numbers: "
        + "; ".join(
            [
                f"average weight {r.weight_average:.1f} kg ({_change(r.weight_change, 'kg')})"
                if r.weight_average is not None
                else "no weigh-ins",
                f"latest waist {r.waist_latest:.1f} cm ({_change(r.waist_change, 'cm')})"
                if r.waist_latest is not None
                else "no waist measured",
                f"{r.days_complete} of 7 days fully logged",
                f"{r.workouts} workouts done",
                f"training volume {r.volume_kg:.0f} kg (week before {r.previous_volume_kg:.0f} kg)",
            ]
        )
        + ".",
        "",
        "Day by day:",
    ]
    for day in week.days:
        lines.extend(_day(day))
    return "\n".join(lines)


class ClaudeWeeklyAdvisor:
    def __init__(
        self,
        api_key: str,
        model: str,
        effort: str,
        *,
        max_retries: int = 1,
        http_client: httpx2.AsyncClient | None = None,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._effort = effort
        self._max_retries = max_retries
        self._http_client = http_client

    async def advise(self, week: WeekDigest) -> WeeklyAdvice:
        if not self._api_key:
            raise ServiceUnavailable("AI 服務尚未設定，請稍後再試")
        try:
            async with anthropic.AsyncAnthropic(
                api_key=self._api_key,
                timeout=_TIMEOUT_S,
                max_retries=self._max_retries,
                http_client=self._http_client,
            ) as client:
                response = await client.beta.messages.parse(
                    model=self._model,
                    max_tokens=16000,
                    system=INSTRUCTIONS,
                    messages=[{"role": "user", "content": render(week)}],
                    output_format=WeeklyAdviceOutput,
                    output_config={"effort": self._effort},
                    betas=[_FALLBACK_BETA],
                    fallbacks="default",
                )
        except anthropic.APIStatusError as exc:
            log.warning("weekly advice: HTTP %s from Claude: %s", exc.status_code, exc.message)
            raise ServiceUnavailable("AI 服務暫時不可用") from exc
        except anthropic.APIConnectionError as exc:
            # Timeouts land here too.
            log.warning("weekly advice: no answer from Claude: %s", exc)
            raise ServiceUnavailable("AI 服務暫時不可用") from exc
        except ValueError as exc:
            # Unparseable JSON, or JSON outside the schema's limits (checked client-side).
            log.warning("weekly advice: output outside the schema: %s", exc)
            raise ServiceUnavailable("AI 服務暫時不可用") from exc

        if response.stop_reason == "refusal":
            log.warning("weekly advice: declined (%s)", getattr(response, "stop_details", None))
            raise ServiceUnavailable("這週的建議暫時無法產生")
        output = response.parsed_output
        if output is None:
            log.warning("weekly advice: no output (stop_reason=%s)", response.stop_reason)
            raise ServiceUnavailable("AI 服務暫時不可用")
        return WeeklyAdvice(
            summary=output.summary, diet=output.diet, training=output.training, body=output.body
        )
