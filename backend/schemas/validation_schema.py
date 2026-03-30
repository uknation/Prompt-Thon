from __future__ import annotations

from pydantic import Field

from .base import StrictBaseModel
from .parsing_schema import ParsingOutput


class ValidationIssue(StrictBaseModel):
    code: str
    severity: str
    message: str
    element_ids: list[int] = Field(default_factory=list)


class ValidationOutput(StrictBaseModel):
    parsed: ParsingOutput
    status: str
    corrections: list[str]
    issues: list[ValidationIssue]
    snapped_points: int
    resolved_intersections: int
    dangling_walls_fixed: int
