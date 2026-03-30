from __future__ import annotations

import logging

from ..schemas.input_schema import StructuralPlanInput
from ..schemas.pipeline_schema import PipelineResult, PipelineStageOutputs, StageLog
from ..services.explain import ExplainabilityService
from ..services.geometry import GeometryService
from ..services.materials import MaterialsService
from ..services.model3d import Model3DService
from ..services.parsing import ParsingService
from ..services.validation import ValidationService

logger = logging.getLogger(__name__)


class AutonomousStructuralPipeline:
    def __init__(
        self,
        parsing_service: ParsingService | None = None,
        validation_service: ValidationService | None = None,
        geometry_service: GeometryService | None = None,
        model_service: Model3DService | None = None,
        materials_service: MaterialsService | None = None,
        explain_service: ExplainabilityService | None = None,
    ) -> None:
        self.parsing_service = parsing_service or ParsingService()
        self.validation_service = validation_service or ValidationService()
        self.geometry_service = geometry_service or GeometryService()
        self.model_service = model_service or Model3DService()
        self.materials_service = materials_service or MaterialsService()
        self.explain_service = explain_service or ExplainabilityService()

    def run_plan(self, plan: StructuralPlanInput) -> PipelineResult:
        parsed = self.parsing_service.parse_plan(plan)
        return self._run_from_parsed(parsed, source=f'plan:{plan.id or plan.name}')

    def run_image(self, image_bytes: bytes, filename: str | None = None) -> PipelineResult:
        parsed = self.parsing_service.parse_image(image_bytes)
        return self._run_from_parsed(parsed, source=f'image:{filename or "upload"}')

    def _run_from_parsed(self, parsed, source: str) -> PipelineResult:
        logs = [StageLog(stage='parsing', status='completed', message=f'Parsed {len(parsed.walls)} wall candidates with confidence {parsed.confidence:.2f}.')]
        validation = self.validation_service.validate(parsed)
        logs.append(StageLog(stage='validation', status=validation.status, message='Validation completed with auto-correction and issue capture.'))
        geometry = self.geometry_service.reconstruct(validation.parsed)
        logs.append(StageLog(stage='geometry', status='completed', message=f'Reconstructed {len(geometry.nodes)} nodes, {len(geometry.edges)} edges, and {len(geometry.rooms)} rooms.'))
        model3d = self.model_service.generate(geometry)
        logs.append(StageLog(stage='model3d', status='completed', message=f'Generated {len(model3d.elements)} 3D elements.'))
        materials = self.materials_service.recommend(geometry, model3d)
        logs.append(StageLog(stage='materials', status='completed', message=f'Scored materials for {len(materials.results)} structural elements.'))
        explainability = self.explain_service.build(geometry, materials)
        logs.append(StageLog(stage='explainability', status='completed', message=f'Generated {len(explainability.results)} element-level explanations.'))

        warnings = [issue.message for issue in validation.issues]
        result = PipelineResult(
            success=validation.status != 'error',
            source=source,
            stage_outputs=PipelineStageOutputs(
                parsing=parsed,
                validation=validation,
                geometry=geometry,
                model3d=model3d,
                materials=materials,
                explainability=explainability,
            ),
            logs=logs,
            warnings=warnings,
        )
        return result
