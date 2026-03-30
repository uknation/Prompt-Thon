from __future__ import annotations

import logging
import math

from ..schemas.geometry_schema import GeometryOutput
from ..schemas.model3d_schema import Model3DOutput, ModelElement

logger = logging.getLogger(__name__)


class Model3DService:
    """Stage 3 conversion from validated geometry graph to 3D-ready elements."""

    def generate(self, geometry: GeometryOutput) -> Model3DOutput:
        logger.info('Generating 3D element payload from %s edges.', len(geometry.edges))
        node_lookup = {node.id: node for node in geometry.nodes}
        elements: list[ModelElement] = []
        next_id = 1
        wall_type_lookup = geometry.wall_types

        for edge in geometry.edges:
            start = node_lookup[edge.start]
            end = node_lookup[edge.end]
            length = edge.length
            height = 3.2 if edge.type == 'load_bearing' else 3.0
            thickness = 0.3 if edge.type == 'load_bearing' else 0.14
            position = [round((start.x + end.x) / 2, 3), round(height / 2, 3), round((start.y + end.y) / 2, 3)]
            yaw = round(math.atan2(end.y - start.y, end.x - start.x), 4)
            elements.append(
                ModelElement(
                    id=next_id,
                    type='wall',
                    source_wall_id=edge.source_wall_id,
                    position=position,
                    dimensions=[round(length, 3), round(height, 3), round(thickness, 3)],
                    rotation=[0.0, yaw, 0.0],
                    metadata={
                        'wall_type': edge.type,
                        'edge_id': edge.id,
                        'connected_room_count': len(edge.connected_room_ids),
                    },
                )
            )
            next_id += 1

        for opening in geometry.openings:
            opening_family = 'window' if 'window' in opening.type.lower() else 'door'
            host_wall_type = wall_type_lookup.get(str(opening.host_wall_id), 'partition') if opening.host_wall_id is not None else 'partition'
            host_thickness = 0.3 if host_wall_type == 'load_bearing' else 0.14
            depth = round(max(0.08, host_thickness * 0.48), 3)
            if opening.host_orientation == 'horizontal':
                dimensions = [round(opening.width, 3), round(opening.height, 3), depth]
            else:
                dimensions = [depth, round(opening.height, 3), round(opening.width, 3)]
            elements.append(
                ModelElement(
                    id=next_id,
                    type=opening_family,
                    source_opening_id=opening.id,
                    source_wall_id=opening.host_wall_id,
                    position=[
                        round(opening.position[0], 3),
                        round(opening.sill_height + (opening.height / 2), 3),
                        round(opening.position[1], 3),
                    ],
                    dimensions=dimensions,
                    rotation=[0.0, 0.0, 0.0],
                    metadata={
                        'opening_type': opening.type,
                        'host_wall_type': host_wall_type,
                        'host_wall_id': opening.host_wall_id if opening.host_wall_id is not None else -1,
                        'room_count': len(opening.room_ids),
                        'sill_height': opening.sill_height,
                    },
                )
            )
            next_id += 1

        for room in geometry.rooms:
            boundary = room.boundary[:-1]
            width = max(point[0] for point in boundary) - min(point[0] for point in boundary)
            depth = max(point[1] for point in boundary) - min(point[1] for point in boundary)
            elements.append(
                ModelElement(
                    id=next_id,
                    type='floor',
                    position=[room.centroid[0], 0.05, room.centroid[1]],
                    dimensions=[round(width, 3), 0.1, round(depth, 3)],
                    rotation=[0.0, 0.0, 0.0],
                    metadata={'room_id': room.id, 'area': room.area},
                )
            )
            next_id += 1

        return Model3DOutput(elements=elements)
