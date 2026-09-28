from datetime import date, timedelta

from app.domain.streak import DayRecord, streak_until

TODAY = date(2026, 9, 22)


def day(offset: int, *, body: bool = True, meals: int = 3) -> DayRecord:
    return DayRecord(TODAY - timedelta(days=offset), body_logged=body, meals_resolved=meals)


def test_no_days_means_no_streak():
    assert streak_until([], TODAY) == 0


def test_consecutive_complete_days_ending_today_count():
    assert streak_until([day(0), day(1), day(2)], TODAY) == 3


def test_a_day_needs_the_body_logged_and_all_three_meals_resolved():
    assert streak_until([day(0, body=False)], TODAY) == 0
    assert streak_until([day(0, meals=2)], TODAY) == 0


def test_a_gap_ends_the_streak():
    assert streak_until([day(0), day(1, meals=1), day(2)], TODAY) == 1


def test_a_missing_day_ends_the_streak():
    assert streak_until([day(0), day(2)], TODAY) == 1


def test_the_streak_reads_zero_until_today_is_complete():
    # Pinned on purpose: yesterday and the day before were complete, but today is not yet.
    assert streak_until([day(0, meals=1), day(1), day(2)], TODAY) == 0


def test_days_after_the_given_date_are_ignored():
    assert streak_until([day(-1), day(0)], TODAY) == 1
