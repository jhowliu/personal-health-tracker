from datetime import date, timedelta

import pytest

from app.domain.body_trend import summarize
from app.domain.models import BodyLog

TUESDAY = date(2026, 9, 22)


def series(*weights: float, start: date) -> list[BodyLog]:
    return [
        BodyLog(date=start + timedelta(days=i), weight_kg=w, waist_cm=None)
        for i, w in enumerate(weights)
    ]


def test_moving_average_uses_the_last_seven_days():
    logs = series(*[56.0] * 6, 57.4, start=TUESDAY - timedelta(days=6))
    assert summarize(logs, TUESDAY).weight_series[-1].average_7d == pytest.approx(56.2)


def test_week_over_week_delta():
    last_week = series(56.6, 56.6, start=date(2026, 9, 14))
    this_week = series(56.2, 56.2, start=date(2026, 9, 21))
    summary = summarize(last_week + this_week, TUESDAY)

    assert summary.week_avg_weight == pytest.approx(56.2)
    assert summary.week_avg_delta == pytest.approx(-0.4)


def test_delta_is_none_without_a_prior_week():
    assert summarize(series(56.2, start=TUESDAY), TUESDAY).week_avg_delta is None


def test_waist_tracked_separately_and_may_be_sparser():
    logs = [
        BodyLog(date=TUESDAY - timedelta(days=7), weight_kg=56.5, waist_cm=73.0),
        BodyLog(date=TUESDAY, weight_kg=56.1, waist_cm=72.0),
    ]
    summary = summarize(logs, TUESDAY)

    assert summary.latest_waist == 72.0
    assert len(summary.waist_series) == 2
    assert len(summary.weight_series) == 2


def test_weight_only_entries_do_not_create_waist_points():
    summary = summarize(series(56.1, start=TUESDAY), TUESDAY)
    assert summary.waist_series == ()
    assert summary.latest_waist is None
