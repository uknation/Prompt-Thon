from __future__ import annotations

from .base import StrictBaseModel


class ExplanationItem(StrictBaseModel):
    element_id: int
    explanation: str


class ExplainabilityOutput(StrictBaseModel):
    results: list[ExplanationItem]
    summary: str

