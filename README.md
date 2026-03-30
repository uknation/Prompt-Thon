# Autonomous Structural Intelligence System

AI-powered full-stack system for parsing floor plans, reconstructing structural geometry, generating 3D building elements, recommending materials, and explaining every decision through a traceable pipeline.

## Project Vision

The goal of this project is to bridge architectural layouts and structural reasoning with an end-to-end automated workflow. Instead of stopping at object detection, the system converts plans into structured geometry, reasons about wall roles and spans, and turns those results into usable engineering outputs.

## Core Features

1. Parsing Contract
   Structured extraction of walls, openings, contours, and confidence from plan input.
2. Geometry Validation
   Snapping, wall cleanup, intersection handling, and room-boundary consistency checks.
3. Structural Reasoning
   Outer-boundary and spine-wall detection with support-span driven logic.
4. 3D Generation
   Walls, floors, doors, and windows generated from geometry only.
5. Material Recommendation
   Strength-cost scoring that changes by wall role.
6. Explainability
   Deterministic explanations with optional Gemini enhancement.
7. Full Traceability
   Every run returns stage outputs, logs, and warnings for judge review.

## Architecture

### Backend

`backend/api`
- FastAPI routes only

`backend/core/pipeline.py`
- Central orchestrator for the full pipeline

`backend/services/parsing.py`
- Stage 1 parsing and image post-processing

`backend/services/validation.py`
- Geometry hygiene and correction layer

`backend/services/geometry.py`
- Graph reconstruction, room detection, opening mapping

`backend/services/reasoning.py`
- Structural classification logic

`backend/services/model3d.py`
- 3D-ready wall, floor, door, and window elements

`backend/services/materials.py`
- Material scoring and ranking

`backend/services/explain.py`
- Human-readable reasoning output

`backend/schemas`
- Pydantic contracts for all stages

### Frontend

`src/components/UploadPanel.jsx`
- Input selection and execution controls

`src/components/PipelineViewer.jsx`
- Stage status, logs, warnings, and JSON trace

`src/components/ParsingCanvas.jsx`
- Stage 1 visualization

`src/components/GeometryViewer.jsx`
- Stage 2 topology and reasoning view

`src/components/ThreeStageViewer.jsx`
- Stage 3 interactive 3D view

`src/components/MaterialPanel.jsx`
- Stage 4 recommendations

`src/components/ExplanationPanel.jsx`
- Stage 5 explanations

## Setup

### Backend

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

Compatibility entrypoint:

```bash
python backend/parser_service.py
```

### Frontend

```bash
npm install
npm run dev
```

Optional API override:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Testing

Backend tests:

```bash
python -m unittest backend.tests.test_pipeline -v
```

Frontend production build:

```bash
npm run build
```

## API

`GET /health`
- Service health and available stages
- Includes Gemini configuration status

`GET /samples`
- Sample plan metadata

`GET /samples/{sample_id}`
- Sample plan payload

`POST /pipeline/run/plan`
- Run the full pipeline from structured plan JSON

`POST /pipeline/run/image`
- Run the full pipeline from an uploaded image

## Gemini

Gemini is integrated backend-only for Stage 5 explainability.

```env
GEMINI_ENABLED=true
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_SECONDS=6
```

If Gemini is unavailable, the system falls back to deterministic local explanations.

## OCR Performance

OCR-assisted text masking is optional and disabled by default for speed:

```env
PARSER_ENABLE_OCR=false
```

## Output Trace

Every successful run returns stage outputs like:

```json
{
  "success": true,
  "source": "plan:B",
  "stage_outputs": {
    "parsing": {},
    "validation": {},
    "geometry": {},
    "model3d": {},
    "materials": {},
    "explainability": {}
  },
  "logs": [],
  "warnings": []
}
```

## Presentation Notes

- Use sample plan `B` for the strongest full-pipeline demo.
- The 3D stage now includes walls, floors, doors, and windows.
- The parser includes text suppression, wall-line refinement, and opening-to-wall snapping for cleaner stage output.
