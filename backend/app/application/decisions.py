"""Bounded picks among known options over the single DecisionEngine seam."""

from app.application.ports import DecisionEngine
from app.domain.decisions import DecisionOption, DecisionRequest, DecisionResult
from app.domain.models import Exercise, Food

# Below this a pick counts as no pick: the spec wants the user to confirm anything
# under 0.5 rather than having it quietly pre-filled.
MIN_CONFIDENCE = 0.5


class DecisionService:
    def __init__(self, engine: DecisionEngine) -> None:
        self._engine = engine

    async def food_match(self, label: str, candidates: tuple[Food, ...]) -> DecisionResult:
        """Pick the library food a photo label refers to.

        Candidates come from the caller rather than being looked up here, so the list stays
        the one that was already visibility-checked for that user.
        """
        return await self._decide(
            label,
            "Choose the food from the library that this photo label refers to.",
            tuple(DecisionOption(food.id, food.name) for food in candidates),
        )

    async def exercise_alternative(
        self, subject: str, candidates: tuple[Exercise, ...]
    ) -> DecisionResult:
        """Pick the substitute that best answers the stated reason for swapping."""
        return await self._decide(
            subject,
            "Choose the substitute exercise that best fits the stated reason.",
            tuple(DecisionOption(exercise.id, exercise.name) for exercise in candidates),
        )

    async def _decide(
        self,
        subject: str,
        instruction: str,
        options: tuple[DecisionOption, ...],
    ) -> DecisionResult:
        result = await self._engine.decide(DecisionRequest(subject, instruction, options))
        if result.selection_id not in {option.id for option in options}:
            # Do not turn a hallucinated id into a pick.
            return DecisionResult(None, 0.0, "AI 回覆不在可用選項中，請自行選擇")
        if result.confidence < MIN_CONFIDENCE:
            # Reported as no selection so callers fall back instead of pre-filling a guess.
            return DecisionResult(None, 0.0, "AI 信心不足，請自行確認")
        return result
