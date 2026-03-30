# Autonomous Structural Intelligence System

Production-style full-stack demo for taking a floor plan through:

1. Parsing
2. Validation
3. Geometry reconstruction
4. 3D generation
5. Material reasoning
6. Explainability

The implementation is contract-first: every stage accepts structured input, emits validated structured output, and can be tested independently.

## Architecture

### Backend

`backend/api`
- FastAPI routes only

`backend/core/pipeline.py`
- Central orchestrator that runs the full pipeline and returns traceable stage outputs

`backend/services/parsing.py`
- Stage 1 parser for either structured plan JSON or uploaded images

`backend/services/validation.py`
- Geometry hygiene layer: snapping, overlap cleanup, dangling-wall correction, issue reporting

`backend/services/geometry.py`
- Node and room reconstruction from validated wall data

`backend/services/reasoning.py`
- Outer-boundary detection, spine-wall inference, and support span logic

`backend/services/model3d.py`
- Stage 3 conversion into Three.js-friendly wall and floor elements

`backend/services/materials.py`
- Stage 4 structural material recommendation engine

`backend/services/explain.py`
- Stage 5 explanation generation tied to spans and wall classifications

`backend/schemas`
- Pydantic contracts for every stage

`backend/tests/test_pipeline.py`
- End-to-end and parsing regression tests

### Frontend

`src/components/UploadPanel.jsx`
- Input selection and execution controls

`src/components/PipelineViewer.jsx`
- Stage status cards, warnings, and raw pipeline trace

`src/components/ParsingCanvas.jsx`
- Visualization of stage 1 parsing output

`src/components/GeometryViewer.jsx`
- Visualization of stage 2 nodes, edges, rooms, and wall reasoning

`src/components/ThreeStageViewer.jsx`
- Stage 3 Three.js viewer using only the 3D element contract

`src/components/MaterialPanel.jsx`
- Stage 4 recommendation panel

`src/components/ExplanationPanel.jsx`
- Stage 5 explanation panel

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

Optional frontend API override:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Test

Run backend tests:

```bash
python -m unittest discover -s backend/tests -v
```

Build the frontend:

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

Configure it with:

```env
GEMINI_ENABLED=true
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_SECONDS=6
```

If Gemini is unavailable or returns an error, the system automatically falls back to deterministic local explanations.
If the pipeline feels slow, reduce the timeout or temporarily set `GEMINI_ENABLED=false` while you tune geometry and parsing.

## OCR Performance

The parser uses fast heuristic text suppression by default. Heavy OCR startup is disabled unless you explicitly enable it:

```env
PARSER_ENABLE_OCR=false
```

Set it to `true` only if you specifically want OCR-assisted text masking and can tolerate slower parsing.

## Output Trace

Every run returns:

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

This makes the system easier to judge, debug, and extend without hidden stage coupling.
