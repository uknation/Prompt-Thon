from __future__ import annotations

from .base import StrictBaseModel


class MaterialOption(StrictBaseModel):
    material: str
    score: float
    strength: float
    cost: float
    rationale: str


class MaterialRecommendation(StrictBaseModel):
    element_id: int
    wall_type: str
    recommendations: list[MaterialOption]
    governing_span: float
    governing_reason: str


class MaterialsSummary(StrictBaseModel):
    total_elements: int
    critical_span_count: int
    preferred_load_bearing_material: str
    preferred_partition_material: str


class MaterialsOutput(StrictBaseModel):
    results: list[MaterialRecommendation]
    summary: MaterialsSummary

