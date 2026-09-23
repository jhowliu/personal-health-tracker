"""身形趨勢:7 天移動平均、本週平均與上週相比的變化。"""

from collections.abc import Sequence
from datetime import date, timedelta

from app.domain.models import BodyLog, BodySummary, TrendPoint

MOVING_AVERAGE_DAYS = 7


def _series(
    logs: Sequence[BodyLog], pick: str
) -> tuple[TrendPoint, ...]:
    points = [(log.date, getattr(log, pick)) for log in logs if getattr(log, pick) is not None]
    points.sort(key=lambda p: p[0])

    out: list[TrendPoint] = []
    for day, value in points:
        window_start = day - timedelta(days=MOVING_AVERAGE_DAYS - 1)
        window = [v for d, v in points if window_start <= d <= day]
        out.append(
            TrendPoint(date=day, value=value, average_7d=round(sum(window) / len(window), 2))
        )
    return tuple(out)


def _mean(logs: Sequence[BodyLog], since: date, until: date) -> float | None:
    values = [
        log.weight_kg for log in logs if log.weight_kg is not None and since <= log.date <= until
    ]
    return round(sum(values) / len(values), 2) if values else None


def summarize(logs: Sequence[BodyLog], today: date) -> BodySummary:
    week_start = today - timedelta(days=today.weekday())
    last_week_start = week_start - timedelta(days=7)

    this_week = _mean(logs, week_start, today)
    last_week = _mean(logs, last_week_start, week_start - timedelta(days=1))
    delta = round(this_week - last_week, 2) if this_week is not None and last_week is not None else None

    waists = sorted((log for log in logs if log.waist_cm is not None), key=lambda log: log.date)

    return BodySummary(
        week_avg_weight=this_week,
        week_avg_delta=delta,
        latest_waist=waists[-1].waist_cm if waists else None,
        weight_series=_series(logs, "weight_kg"),
        waist_series=_series(logs, "waist_cm"),
    )
