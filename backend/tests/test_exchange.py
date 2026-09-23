import pytest

from app.domain.exchange import convert, options, round_grams
from app.domain.models import SwapBasis
from tests.factories import (
    BROCCOLI,
    BROWN_RICE,
    CHICKEN_BREAST,
    CHICKEN_THIGH,
    EGG,
    PORK_COLLAR,
    TOFU,
    food,
)


def test_matches_the_spec_worked_example():
    """100 g chicken breast -> thigh: 100 x 31 / 24 = 129.2, rounded to 130 g."""
    swap = convert(CHICKEN_BREAST, 100, CHICKEN_THIGH, SwapBasis.PROTEIN)

    assert swap.grams == 130
    assert not swap.capped


def test_equal_protein_keeps_protein_roughly_level():
    swap = convert(CHICKEN_BREAST, 100, CHICKEN_THIGH, SwapBasis.PROTEIN)

    # 130 g thigh at 24 g/100 g = 31.2 g protein, against 31 g before.
    assert swap.delta.protein_g == pytest.approx(0.2, abs=0.05)
    assert swap.delta.kcal > 0, "thigh is fattier, so calories go up"


def test_equal_calories_keeps_calories_level():
    swap = convert(CHICKEN_BREAST, 100, CHICKEN_THIGH, SwapBasis.KCAL)

    assert swap.delta.kcal == pytest.approx(0, abs=12)
    assert swap.delta.protein_g < 0, "matching calories means less protein from thigh"


def test_staples_swap_on_carbs():
    noodles = food("noodles", "staple", kcal=140, protein=5, fat=1, carb=28, max_grams=300)
    swap = convert(BROWN_RICE, 120, noodles, SwapBasis.CARB)

    # 120 x 23 / 28 = 98.6 -> nearest 5 below 100
    assert swap.grams == 100
    assert swap.delta.carb_g == pytest.approx(0.4, abs=0.2)


class TestRounding:
    def test_below_100_rounds_to_5(self):
        assert round_grams(CHICKEN_BREAST, 62.3) == 60
        assert round_grams(CHICKEN_BREAST, 63.0) == 65

    def test_at_or_above_100_rounds_to_10(self):
        assert round_grams(CHICKEN_BREAST, 129.2) == 130
        assert round_grams(CHICKEN_BREAST, 124.0) == 120

    def test_foods_counted_in_pieces_round_to_whole_units(self):
        assert round_grams(EGG, 129.2) == 150, "2.58 eggs -> 3 eggs -> 150 g"
        assert round_grams(EGG, 60) == 50, "1.2 eggs -> 1 egg"

    def test_never_rounds_down_to_nothing(self):
        assert round_grams(CHICKEN_BREAST, 1.0) == 5
        assert round_grams(EGG, 4.0) == 50


class TestCap:
    def test_stops_at_max_grams(self):
        swap = convert(CHICKEN_BREAST, 100, TOFU, SwapBasis.PROTEIN)

        # 100 x 31 / 8 = 387.5 g of tofu, far past its 200 g cap.
        assert swap.grams == TOFU.max_grams
        assert swap.capped

    def test_capped_swap_reports_the_shortfall(self):
        swap = convert(CHICKEN_BREAST, 100, TOFU, SwapBasis.PROTEIN)

        assert swap.delta.protein_g < 0, "200 g tofu carries less protein than 100 g breast"
        assert not swap.basis_matched

    def test_uncapped_swap_is_marked_as_matched(self):
        assert convert(CHICKEN_BREAST, 100, CHICKEN_THIGH, SwapBasis.PROTEIN).basis_matched


class TestEdges:
    def test_zero_nutrient_in_the_target_keeps_the_portion(self):
        """Swapping by carbs into a food with no carbs has no sensible answer."""
        swap = convert(BROWN_RICE, 120, CHICKEN_BREAST, SwapBasis.CARB)
        assert swap.grams == 120

    def test_basis_none_keeps_the_portion(self):
        swap = convert(BROCCOLI, 150, BROWN_RICE, SwapBasis.NONE)
        assert swap.grams == 150


class TestOptions:
    def test_excludes_the_food_being_replaced(self):
        candidates = (CHICKEN_BREAST, CHICKEN_THIGH, PORK_COLLAR, EGG, TOFU)
        result = options(CHICKEN_BREAST, 100, candidates, SwapBasis.PROTEIN)

        assert CHICKEN_BREAST.id not in [e.food.id for e in result]
        assert len(result) == 4

    def test_orders_by_closest_calories(self):
        candidates = (CHICKEN_THIGH, PORK_COLLAR, TOFU)
        result = options(CHICKEN_BREAST, 100, candidates, SwapBasis.PROTEIN)

        deltas = [abs(e.delta.kcal) for e in result]
        assert deltas == sorted(deltas)
