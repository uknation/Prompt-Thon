from __future__ import annotations

import logging
from collections import Counter

from ..schemas.geometry_schema import GeometryOutput
from ..schemas.materials_schema import MaterialOption, MaterialRecommendation, MaterialsOutput, MaterialsSummary
from ..schemas.model3d_schema import Model3DOutput

logger = logging.getLogger(__name__)

MATERIAL_LIBRARY = {
    'RCC': {'strength': 9.5, 'cost': 6.0},
    'Steel': {'strength': 9.8, 'cost': 7.0},
    'Precast Concrete': {'strength': 8.7, 'cost': 5.6},
    'Red Brick': {'strength': 6.8, 'cost': 3.2},
    'AAC Blocks': {'strength': 4.4, 'cost': 2.1},
    'Fly Ash Brick': {'strength': 5.0, 'cost': 2.4},
    'Hollow Concrete Block': {'strength': 4.8, 'cost': 2.5},
}


class MaterialsService:
    """Stage 4 recommendation engine driven by structural rules."""

    def recommend(self, geometry: GeometryOutput, model3d: Model3DOutput) -> MaterialsOutput:
        logger.info('Scoring materials for %s wall elements.', len([item for item in model3d.elements if item.type == 'wall']))
        reasoning_lookup = {item.wall_id: item for item in geometry.wall_reasoning}
        results: list[MaterialRecommendation] = []

        for element in model3d.elements:
            if element.type != 'wall' or element.source_wall_id is None:
                continue
            reasoning = reasoning_lookup[element.source_wall_id]
            wall_type = reasoning.wall_type
            weight_strength, weight_cost = (0.7, 0.3) if wall_type == 'load_bearing' else (0.3, 0.7)

            ranked: list[MaterialOption] = []
            for material_name, metrics in MATERIAL_LIBRARY.items():
                score = (weight_strength * metrics['strength']) - (weight_cost * metrics['cost'])
                rationale_bits = [f'base score uses {weight_strength:.1f} strength weight and {weight_cost:.1f} cost weight']

                if wall_type == 'load_bearing' and metrics['strength'] < 7.0:
                    score -= 1.2
                    rationale_bits.append('penalized for insufficient structural reserve')
                if wall_type == 'partition' and metrics['cost'] <= 2.5:
                    score += 0.4
                    rationale_bits.append('rewarded for low partition cost')
                if wall_type == 'partition' and metrics['strength'] > 8.5:
                    score -= 0.2
                    rationale_bits.append('slightly penalized for overspecification')
                if reasoning.span > 5.0 and material_name not in {'RCC', 'Steel', 'Precast Concrete'}:
                    score -= 2.5
                    rationale_bits.append('fails the >5m long-span preference rule')
                elif reasoning.span > 5.0:
                    score += 0.6
                    rationale_bits.append('boosted for long-span suitability')

                ranked.append(
                    MaterialOption(
                        material=material_name,
                        score=round(score, 3),
                        strength=metrics['strength'],
                        cost=metrics['cost'],
                        rationale='; '.join(rationale_bits),
                    )
                )

            ranked.sort(key=lambda item: item.score, reverse=True)
            results.append(
                MaterialRecommendation(
                    element_id=element.id,
                    wall_type=wall_type,
                    recommendations=ranked[:4],
                    governing_span=round(reasoning.span, 3),
                    governing_reason=reasoning.reason,
                )
            )

        load_top = [item.recommendations[0].material for item in results if item.wall_type == 'load_bearing']
        partition_top = [item.recommendations[0].material for item in results if item.wall_type == 'partition']
        summary = MaterialsSummary(
            total_elements=len(results),
            critical_span_count=sum(1 for item in results if item.governing_span > 5.0),
            preferred_load_bearing_material=self._most_common(load_top, default='RCC'),
            preferred_partition_material=self._most_common(partition_top, default='AAC Blocks'),
        )
        return MaterialsOutput(results=results, summary=summary)

    def _most_common(self, items: list[str], default: str) -> str:
        if not items:
            return default
        return Counter(items).most_common(1)[0][0]
