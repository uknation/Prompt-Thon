from __future__ import annotations

from .base import StrictBaseModel
from .explain_schema import ExplainabilityOutput
from .geometry_schema import GeometryOutput
from .materials_schema import MaterialsOutput
from .model3d_schema import Model3DOutput
from .parsing_schema import ParsingOutput
from .validation_schema import ValidationOutput


class StageLog(StrictBaseModel):
    stage: str
    status: str
    message: str


class PipelineStageOutputs(StrictBaseModel):
    parsing: ParsingOutput
    validation: ValidationOutput
    geometry: GeometryOutput
    model3d: Model3DOutput
    materials: MaterialsOutput
    explainability: ExplainabilityOutput


class PipelineResult(StrictBaseModel):
    success: bool
    source: str
    stage_outputs: PipelineStageOutputs
    logs: list[StageLog]
    warnings: list[str]
