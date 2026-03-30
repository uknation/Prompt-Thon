from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..core.pipeline import AutonomousStructuralPipeline
from ..core.settings import get_settings
from ..data.sample_inputs import SAMPLE_PLANS
from ..schemas.input_schema import PlanPipelineRequest, StructuralPlanInput

router = APIRouter()
pipeline = AutonomousStructuralPipeline()


@router.get('/health')
def health():
    settings = get_settings()
    return {
        'ok': True,
        'pipeline': {
            'stages': ['parsing', 'validation', 'geometry', 'model3d', 'materials', 'explainability'],
            'samples': list(SAMPLE_PLANS.keys()),
        },
        'gemini': {
            'enabled': settings.gemini_enabled,
            'configured': bool(settings.gemini_api_key),
            'model': settings.gemini_model,
        },
    }


@router.get('/samples')
def list_samples():
    return [{'id': key, 'name': plan['name'], 'description': plan['description']} for key, plan in SAMPLE_PLANS.items()]


@router.get('/samples/{sample_id}')
def get_sample(sample_id: str):
    sample = SAMPLE_PLANS.get(sample_id.upper())
    if not sample:
        raise HTTPException(status_code=404, detail='Sample not found')
    return sample


@router.post('/pipeline/run')
def run_pipeline(request: PlanPipelineRequest):
    return pipeline.run_plan(request.plan)


@router.post('/pipeline/run/plan')
def run_pipeline_from_plan(request: PlanPipelineRequest):
    return pipeline.run_plan(request.plan)


@router.post('/pipeline/run/sample/{sample_id}')
def run_pipeline_from_sample(sample_id: str):
    sample = SAMPLE_PLANS.get(sample_id.upper())
    if not sample:
        raise HTTPException(status_code=404, detail='Sample not found')
    return pipeline.run_plan(StructuralPlanInput(**sample))


@router.post('/pipeline/run/image')
async def run_pipeline_from_image(file: UploadFile = File(...)):
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail='Empty file upload')
    return pipeline.run_image(payload, filename=file.filename)
