"""Framework-free types for bounded AI decisions."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class DecisionOption:
    id: str
    label: str


@dataclass(frozen=True, slots=True)
class DecisionRequest:
    subject: str
    instruction: str
    options: tuple[DecisionOption, ...]


@dataclass(frozen=True, slots=True)
class DecisionResult:
    selection_id: str | None
    confidence: float
    rationale: str | None
