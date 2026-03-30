from __future__ import annotations

import logging
from statistics import median

from ..schemas.geometry_schema import WallReasoning

logger = logging.getLogger(__name__)


class StructuralReasoningService:
    """Infers wall roles from topology rather than raw positional labels."""

    def classify_walls(
        self,
        wall_summaries: dict[int, dict],
        support_node_ids_by_wall: dict[int, list[int]],
    ) -> tuple[dict[str, str], list[WallReasoning]]:
        logger.info('Reasoning over %s wall summaries.', len(wall_summaries))
        interior_lengths = [summary['length'] for summary in wall_summaries.values() if not summary['is_outer_boundary']]
        spine_threshold = max(4.0, median(interior_lengths) if interior_lengths else 0.0)

        wall_types: dict[str, str] = {}
        reasoning: list[WallReasoning] = []
        for wall_id, summary in wall_summaries.items():
            connected_rooms = sorted(summary['connected_room_ids'])
            support_node_ids = sorted(set(support_node_ids_by_wall.get(wall_id, [])))
            is_spine = (
                not summary['is_outer_boundary']
                and summary['length'] >= spine_threshold
                and len(connected_rooms) >= 2
                and len(support_node_ids) >= 2
            )
            span_governs = summary['span'] > 5.0
            wall_type = 'load_bearing' if summary['is_outer_boundary'] or is_spine or span_governs else 'partition'

            reasons = []
            if summary['is_outer_boundary']:
                reasons.append('it sits on the outer boundary')
            if is_spine:
                reasons.append('it acts as a continuous central spine wall')
            if span_governs:
                reasons.append(f'its support span reaches {summary["span"]:.2f}m')
            if not reasons:
                reasons.append('it mainly subdivides internal room cells')

            reason_text = ', '.join(reasons)
            wall_types[str(wall_id)] = wall_type
            reasoning.append(
                WallReasoning(
                    wall_id=wall_id,
                    wall_type=wall_type,
                    is_outer_boundary=summary['is_outer_boundary'],
                    is_spine=is_spine,
                    connected_room_ids=connected_rooms,
                    support_node_ids=support_node_ids,
                    span=round(summary['span'], 3),
                    length=round(summary['length'], 3),
                    reason=reason_text,
                )
            )
        return wall_types, reasoning
