"""Swapping one food for another while holding a nutrient constant.

The spec's rule:

    new grams = old grams * (source nutrient per 100 g / target nutrient per 100 g)

Which nutrient is held constant comes from the food category: staples match on carbs,
protein foods on protein, everything else on calories. The user can override it to
calories from the substitute screen.
"""

from app.domain.models import Exchange, Food, Nutrients, SwapBasis

ROUND_TO_5_BELOW = 100.0
"""Under 100 g round to the nearest 5 g, at or above it round to the nearest 10 g."""


def round_grams(food: Food, grams: float) -> float:
    """Round to a portion a person can actually measure.

    Foods counted in pieces or scoops round to whole units (half an egg is not a
    portion anyone weighs out); everything else rounds to 5 g or 10 g.
    """
    if food.grams_per_unit:
        units = max(round(grams / food.grams_per_unit), 1)
        return round(units * food.grams_per_unit, 2)

    step = 5.0 if grams < ROUND_TO_5_BELOW else 10.0
    return max(round(grams / step) * step, step)


def convert(source: Food, grams: float, target: Food, basis: SwapBasis) -> Exchange:
    """Work out how much `target` replaces `grams` of `source`.

    When the swap would exceed the target's max_grams we stop at the cap and report
    the shortfall in `delta` — the substitute screen shows that as "already at the
    usual portion limit, protein will be lower than before".
    """
    original = source.nutrients_for(grams)

    source_amount = source.amount_of(basis)
    target_amount = target.amount_of(basis)

    if basis is SwapBasis.NONE or target_amount <= 0 or source_amount <= 0:
        # Nothing sensible to hold constant, so keep the portion as-is.
        equal_grams = grams
    else:
        equal_grams = grams * source_amount / target_amount

    rounded = round_grams(target, equal_grams)
    capped = rounded > target.max_grams
    final = target.max_grams if capped else rounded

    nutrients = target.nutrients_for(final)
    return Exchange(
        food=target,
        grams=round(final, 2),
        nutrients=nutrients.rounded(),
        delta=_delta(nutrients, original),
        capped=capped,
    )


def options(
    source: Food, grams: float, candidates: tuple[Food, ...], basis: SwapBasis
) -> tuple[Exchange, ...]:
    """Every same-category swap for one food, ordered by how close the calories land.

    The source itself is skipped — it is shown separately as "currently eating".
    """
    exchanges = [
        convert(source, grams, candidate, basis)
        for candidate in candidates
        if candidate.id != source.id
    ]
    exchanges.sort(key=lambda e: abs(e.delta.kcal))
    return tuple(exchanges)


def _delta(after: Nutrients, before: Nutrients) -> Nutrients:
    return Nutrients(
        kcal=round(after.kcal - before.kcal, 1),
        protein_g=round(after.protein_g - before.protein_g, 1),
        fat_g=round(after.fat_g - before.fat_g, 1),
        carb_g=round(after.carb_g - before.carb_g, 1),
    )
