from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

from ..core.settings import get_settings
from ..schemas.explain_schema import ExplainabilityOutput, ExplanationItem
from ..schemas.geometry_schema import GeometryOutput
from ..schemas.materials_schema import MaterialsOutput

logger = logging.getLogger(__name__)


class ExplainabilityService:
    """Stage 5 human-readable structural narrative layer."""

    def build(self, geometry: GeometryOutput, materials: MaterialsOutput) -> ExplainabilityOutput:
        settings = get_settings()
        template_output = self._build_template(geometry, materials)
        if not settings.gemini_enabled or not settings.gemini_api_key:
            return template_output

        try:
            return self._build_with_gemini(
                geometry,
                materials,
                settings.gemini_api_key,
                settings.gemini_model,
                settings.gemini_timeout_seconds,
            )
        except Exception as exc:  # pragma: no cover
            logger.warning('Gemini explainability fallback activated: %s', exc)
            return template_output

    def _build_template(self, geometry: GeometryOutput, materials: MaterialsOutput) -> ExplainabilityOutput:
        logger.info('Building explanations for %s material decisions.', len(materials.results))
        reasoning_lookup = {item.wall_id: item for item in geometry.wall_reasoning}
        explanations: list[ExplanationItem] = []

        for result in materials.results:
            top = result.recommendations[0]
            reasoning = reasoning_lookup.get(self._wall_id_from_result(result, geometry))
            if reasoning is None:
                continue
            explanation = (
                f"This wall spans {reasoning.span:.2f}m and is classified as {reasoning.wall_type.replace('_', '-')} "
                f"because {reasoning.reason}. It connects {len(reasoning.connected_room_ids)} room boundaries and "
                f"anchors into {len(reasoning.support_node_ids)} support nodes. {top.material} ranks highest because "
                f"{top.rationale}."
            )
            explanations.append(ExplanationItem(element_id=result.element_id, explanation=explanation))

        load_count = sum(1 for item in geometry.wall_reasoning if item.wall_type == 'load_bearing')
        partition_count = sum(1 for item in geometry.wall_reasoning if item.wall_type == 'partition')
        summary = (
            f'The pipeline identified {load_count} load-bearing walls and {partition_count} partition walls. '
            f'Material choices reflect span demand, boundary role, and spine-wall continuity.'
        )
        return ExplainabilityOutput(results=explanations, summary=summary)

    def _build_with_gemini(
        self,
        geometry: GeometryOutput,
        materials: MaterialsOutput,
        api_key: str,
        model: str,
        timeout_seconds: float,
    ) -> ExplainabilityOutput:
        logger.info('Building explainability using Gemini model %s with %.1fs timeout.', model, timeout_seconds)
        payload = {
            'summary': {
                'load_bearing_count': sum(1 for item in geometry.wall_reasoning if item.wall_type == 'load_bearing'),
                'partition_count': sum(1 for item in geometry.wall_reasoning if item.wall_type == 'partition'),
                'critical_span_count': materials.summary.critical_span_count,
                'preferred_load_bearing_material': materials.summary.preferred_load_bearing_material,
                'preferred_partition_material': materials.summary.preferred_partition_material,
            },
            'elements': [
                {
                    'element_id': item.element_id,
                    'wall_type': item.wall_type,
                    'governing_span': item.governing_span,
                    'governing_reason': item.governing_reason,
                    'recommendations': [recommendation.model_dump() for recommendation in item.recommendations[:3]],
                    'geometry_reasoning': next(
                        (
                            reasoning.model_dump()
                            for reasoning in geometry.wall_reasoning
                            if reasoning.wall_id == self._wall_id_from_result(item, geometry)
                        ),
                        {},
                    ),
                }
                for item in materials.results
            ],
        }

        request_body = {
            'contents': [
                {
                    'parts': [
                        {
                            'text': (
                                'You are a structural engineering explanation assistant. '
                                'Return strict JSON in the shape '
                                '{"summary":"...","results":[{"element_id":1,"explanation":"..."}]}. '
                                'Every explanation must mention span, wall type, and why the top material was selected. '
                                'Keep the summary to 2 sentences and each explanation to 2-3 sentences.'
                            )
                        },
                        {'text': json.dumps(payload, ensure_ascii=True)},
                    ]
                }
            ],
            'generationConfig': {
                'temperature': 0.2,
                'responseMimeType': 'application/json',
            },
        }

        request = urllib.request.Request(
            url=f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
            data=json.dumps(request_body).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'x-goog-api-key': api_key,
            },
            method='POST',
        )

        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                raw_response = json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode('utf-8', errors='ignore')
            raise RuntimeError(f'Gemini request failed with HTTP {exc.code}: {detail[:240]}') from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f'Gemini request failed: {exc.reason}') from exc

        text = (
            raw_response.get('candidates', [{}])[0]
            .get('content', {})
            .get('parts', [{}])[0]
            .get('text', '')
        )
        if not text:
            raise RuntimeError('Gemini returned no explanation payload.')

        parsed = json.loads(text)
        results = [
            ExplanationItem(
                element_id=int(item['element_id']),
                explanation=str(item['explanation']).strip(),
            )
            for item in parsed.get('results', [])
            if 'element_id' in item and str(item.get('explanation', '')).strip()
        ]
        summary = str(parsed.get('summary', '')).strip()

        if not results or not summary:
            raise RuntimeError('Gemini response was missing summary or element explanations.')

        return ExplainabilityOutput(results=results, summary=summary)

    def _wall_id_from_result(self, result, geometry: GeometryOutput) -> int:
        for edge in geometry.edges:
            if edge.id == result.element_id:
                return edge.source_wall_id
        element_lookup = {edge.id: edge.source_wall_id for edge in geometry.edges}
        return element_lookup.get(result.element_id, geometry.edges[0].source_wall_id)
