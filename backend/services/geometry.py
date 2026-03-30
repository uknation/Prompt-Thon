from __future__ import annotations

import logging
from collections import defaultdict

from ..schemas.geometry_schema import GeometryEdge, GeometryNode, GeometryOpening, GeometryOutput, GeometryRoom
from ..schemas.parsing_schema import ParsingOutput
from .reasoning import StructuralReasoningService

logger = logging.getLogger(__name__)
EPSILON = 1e-6
ROOM_ADJACENCY_TOLERANCE = 0.55
OPENING_HOST_TOLERANCE = 0.45
OPENING_ROOM_OFFSET = 0.42


class GeometryService:
    """Stage 2 reconstruction from validated wall segments to graph geometry."""

    def __init__(self, reasoning_service: StructuralReasoningService | None = None) -> None:
        self.reasoning_service = reasoning_service or StructuralReasoningService()

    def reconstruct(self, parsing: ParsingOutput) -> GeometryOutput:
        logger.info('Reconstructing geometry graph from %s validated walls.', len(parsing.walls))
        split_points_by_wall = self._collect_split_points(parsing)
        node_lookup: dict[tuple[float, float], int] = {}
        nodes: list[GeometryNode] = []
        edges_buffer: list[dict] = []
        next_node_id = 1
        next_edge_id = 1

        for wall in parsing.walls:
            orientation = self._orientation(wall)
            points = split_points_by_wall[wall.id]
            ordered = sorted(points, key=lambda item: item[0] if orientation == 'horizontal' else item[1])
            for start_point, end_point in zip(ordered, ordered[1:]):
                if self._segment_length(start_point, end_point) <= EPSILON:
                    continue
                start_id, next_node_id = self._get_node_id(start_point, node_lookup, nodes, next_node_id)
                end_id, next_node_id = self._get_node_id(end_point, node_lookup, nodes, next_node_id)
                edges_buffer.append(
                    {
                        'id': next_edge_id,
                        'start': start_id,
                        'end': end_id,
                        'source_wall_id': wall.id,
                        'length': round(self._segment_length(start_point, end_point), 3),
                        'span': round(self._segment_length(start_point, end_point), 3),
                        'points': (start_point, end_point),
                    }
                )
                next_edge_id += 1

        rooms = self._detect_rooms(parsing)
        edge_room_ids = self._map_edges_to_rooms(edges_buffer, rooms)
        node_degree: dict[int, int] = defaultdict(int)
        for edge in edges_buffer:
            node_degree[edge['start']] += 1
            node_degree[edge['end']] += 1

        wall_summaries: dict[int, dict] = defaultdict(lambda: {'length': 0.0, 'span': 0.0, 'connected_room_ids': set(), 'is_outer_boundary': False})
        support_node_ids_by_wall: dict[int, list[int]] = defaultdict(list)
        for edge in edges_buffer:
            connected_rooms = edge_room_ids.get(edge['id'], [])
            wall_summary = wall_summaries[edge['source_wall_id']]
            wall_summary['length'] += edge['length']
            wall_summary['span'] = max(wall_summary['span'], edge['span'])
            wall_summary['connected_room_ids'].update(connected_rooms)
            if len(connected_rooms) <= 1:
                wall_summary['is_outer_boundary'] = True
            for node_id in (edge['start'], edge['end']):
                point = self._node_point(node_id, nodes)
                if node_degree[node_id] >= 2 or self._is_extreme_point(point, nodes):
                    support_node_ids_by_wall[edge['source_wall_id']].append(node_id)

        normalized_summaries = {
            wall_id: {
                **summary,
                'connected_room_ids': sorted(summary['connected_room_ids']),
            }
            for wall_id, summary in wall_summaries.items()
        }
        wall_types, wall_reasoning = self.reasoning_service.classify_walls(normalized_summaries, support_node_ids_by_wall)
        openings = self._map_openings(parsing, rooms)

        edges = [
            GeometryEdge(
                id=edge['id'],
                start=edge['start'],
                end=edge['end'],
                type=wall_types[str(edge['source_wall_id'])],
                source_wall_id=edge['source_wall_id'],
                length=edge['length'],
                span=edge['span'],
                connected_room_ids=edge_room_ids.get(edge['id'], []),
            )
            for edge in edges_buffer
        ]

        return GeometryOutput(
            nodes=nodes,
            edges=edges,
            rooms=rooms,
            openings=openings,
            wall_types=wall_types,
            wall_reasoning=wall_reasoning,
        )

    def _collect_split_points(self, parsing: ParsingOutput) -> dict[int, list[tuple[float, float]]]:
        split_points: dict[int, list[tuple[float, float]]] = {
            wall.id: [(wall.x1, wall.y1), (wall.x2, wall.y2)] for wall in parsing.walls
        }
        for wall in parsing.walls:
            if self._orientation(wall) != 'horizontal':
                continue
            for other in parsing.walls:
                if self._orientation(other) != 'vertical':
                    continue
                x = other.x1
                y = wall.y1
                if wall.x1 - EPSILON <= x <= wall.x2 + EPSILON and other.y1 - EPSILON <= y <= other.y2 + EPSILON:
                    split_points[wall.id].append((round(x, 3), round(y, 3)))
                    split_points[other.id].append((round(x, 3), round(y, 3)))
        return {wall_id: sorted(set(points)) for wall_id, points in split_points.items()}

    def _detect_rooms(self, parsing: ParsingOutput) -> list[GeometryRoom]:
        contour_rooms = [contour for contour in parsing.raw_contours if contour.label != 'outer-shell']
        if contour_rooms:
            rooms = []
            for room_id, contour in enumerate(contour_rooms, start=1):
                xs = [point[0] for point in contour.points[:-1]]
                ys = [point[1] for point in contour.points[:-1]]
                rooms.append(
                    GeometryRoom(
                        id=room_id,
                        boundary=[[round(point[0], 3), round(point[1], 3)] for point in contour.points],
                        area=round(self._polygon_area(contour.points), 3),
                        centroid=[round(sum(xs) / len(xs), 3), round(sum(ys) / len(ys), 3)],
                    )
                )
            return rooms

        xs = sorted({round(point, 3) for wall in parsing.walls for point in (wall.x1, wall.x2)})
        ys = sorted({round(point, 3) for wall in parsing.walls for point in (wall.y1, wall.y2)})
        rooms: list[GeometryRoom] = []
        room_id = 1
        for left, right in zip(xs, xs[1:]):
            for top, bottom in zip(ys, ys[1:]):
                if right - left < 0.3 or bottom - top < 0.3:
                    continue
                if not self._cell_closed(left, right, top, bottom, parsing):
                    continue
                rooms.append(
                    GeometryRoom(
                        id=room_id,
                        boundary=[
                            [round(left, 3), round(top, 3)],
                            [round(right, 3), round(top, 3)],
                            [round(right, 3), round(bottom, 3)],
                            [round(left, 3), round(bottom, 3)],
                            [round(left, 3), round(top, 3)],
                        ],
                        area=round((right - left) * (bottom - top), 3),
                        centroid=[round((left + right) / 2, 3), round((top + bottom) / 2, 3)],
                    )
                )
                room_id += 1
        return rooms

    def _map_edges_to_rooms(self, edges: list[dict], rooms: list[GeometryRoom]) -> dict[int, list[int]]:
        mapping: dict[int, list[int]] = {}
        for edge in edges:
            start_point, end_point = edge['points']
            connected = []
            for room in rooms:
                if self._edge_on_room_boundary(start_point, end_point, room):
                    connected.append(room.id)
            mapping[edge['id']] = connected
        return mapping

    def _map_openings(self, parsing: ParsingOutput, rooms: list[GeometryRoom]) -> list[GeometryOpening]:
        openings: list[GeometryOpening] = []
        for opening in parsing.openings:
            host_wall = self._find_host_wall(opening, parsing)
            position = self._snap_opening_position(opening, host_wall)
            room_ids = self._find_opening_rooms(position, opening.host_orientation, rooms)
            openings.append(
                GeometryOpening(
                    id=opening.id,
                    type=opening.type,
                    hostOrientation=opening.host_orientation,
                    hostWallId=host_wall.id if host_wall is not None else None,
                    position=position,
                    width=round(opening.width, 3),
                    height=round(opening.height, 3),
                    sillHeight=0.9 if 'window' in opening.type.lower() else 0.0,
                    roomIds=room_ids,
                )
            )
        return openings

    def _find_host_wall(self, opening, parsing: ParsingOutput):
        best_wall = None
        best_score = float('inf')
        for wall in parsing.walls:
            if self._orientation(wall) != opening.host_orientation:
                continue
            if opening.host_orientation == 'horizontal':
                axis_distance = abs(opening.y - wall.y1)
                if opening.x < wall.x1 - OPENING_HOST_TOLERANCE or opening.x > wall.x2 + OPENING_HOST_TOLERANCE:
                    continue
                score = axis_distance + min(abs(opening.x - wall.x1), abs(opening.x - wall.x2)) * 0.01
            else:
                axis_distance = abs(opening.x - wall.x1)
                if opening.y < wall.y1 - OPENING_HOST_TOLERANCE or opening.y > wall.y2 + OPENING_HOST_TOLERANCE:
                    continue
                score = axis_distance + min(abs(opening.y - wall.y1), abs(opening.y - wall.y2)) * 0.01
            if axis_distance > max(OPENING_HOST_TOLERANCE, wall.thickness * 2.2):
                continue
            if score < best_score:
                best_score = score
                best_wall = wall
        return best_wall

    def _snap_opening_position(self, opening, wall) -> list[float]:
        if wall is None:
            return [round(opening.x, 3), round(opening.y, 3)]

        if opening.host_orientation == 'horizontal':
            half_width = opening.width / 2
            min_x = min(wall.x1, wall.x2) + min(half_width, 0.08)
            max_x = max(wall.x1, wall.x2) - min(half_width, 0.08)
            x = self._clamp(opening.x, min_x, max_x) if min_x <= max_x else opening.x
            return [round(x, 3), round(wall.y1, 3)]

        half_width = opening.width / 2
        min_y = min(wall.y1, wall.y2) + min(half_width, 0.08)
        max_y = max(wall.y1, wall.y2) - min(half_width, 0.08)
        y = self._clamp(opening.y, min_y, max_y) if min_y <= max_y else opening.y
        return [round(wall.x1, 3), round(y, 3)]

    def _find_opening_rooms(self, position: list[float], orientation: str, rooms: list[GeometryRoom]) -> list[int]:
        x, y = position
        offset = OPENING_ROOM_OFFSET
        samples = [(x, y - offset), (x, y + offset)] if orientation == 'horizontal' else [(x - offset, y), (x + offset, y)]
        room_ids: list[int] = []
        for sample_x, sample_y in samples:
            room_id = self._room_containing_point(sample_x, sample_y, rooms)
            if room_id is not None and room_id not in room_ids:
                room_ids.append(room_id)
        return room_ids

    def _room_containing_point(self, x: float, y: float, rooms: list[GeometryRoom]) -> int | None:
        for room in rooms:
            xs = [point[0] for point in room.boundary[:-1]]
            ys = [point[1] for point in room.boundary[:-1]]
            if min(xs) - 0.06 <= x <= max(xs) + 0.06 and min(ys) - 0.06 <= y <= max(ys) + 0.06:
                return room.id
        return None

    def _edge_on_room_boundary(self, start_point: tuple[float, float], end_point: tuple[float, float], room: GeometryRoom) -> bool:
        left = min(point[0] for point in room.boundary[:-1])
        right = max(point[0] for point in room.boundary[:-1])
        top = min(point[1] for point in room.boundary[:-1])
        bottom = max(point[1] for point in room.boundary[:-1])

        if abs(start_point[1] - end_point[1]) < EPSILON:
            y = start_point[1]
            x1 = min(start_point[0], end_point[0])
            x2 = max(start_point[0], end_point[0])
            return (
                (abs(y - top) <= ROOM_ADJACENCY_TOLERANCE or abs(y - bottom) <= ROOM_ADJACENCY_TOLERANCE)
                and x2 >= left - ROOM_ADJACENCY_TOLERANCE
                and x1 <= right + ROOM_ADJACENCY_TOLERANCE
            )

        x = start_point[0]
        y1 = min(start_point[1], end_point[1])
        y2 = max(start_point[1], end_point[1])
        return (
            (abs(x - left) <= ROOM_ADJACENCY_TOLERANCE or abs(x - right) <= ROOM_ADJACENCY_TOLERANCE)
            and y2 >= top - ROOM_ADJACENCY_TOLERANCE
            and y1 <= bottom + ROOM_ADJACENCY_TOLERANCE
        )

    def _cell_closed(self, left: float, right: float, top: float, bottom: float, parsing: ParsingOutput) -> bool:
        return (
            self._has_horizontal_wall(parsing, top, left, right)
            and self._has_horizontal_wall(parsing, bottom, left, right)
            and self._has_vertical_wall(parsing, left, top, bottom)
            and self._has_vertical_wall(parsing, right, top, bottom)
        )

    def _has_horizontal_wall(self, parsing: ParsingOutput, y: float, left: float, right: float) -> bool:
        for wall in parsing.walls:
            if self._orientation(wall) != 'horizontal':
                continue
            if abs(wall.y1 - y) > EPSILON:
                continue
            if wall.x1 <= left + EPSILON and wall.x2 >= right - EPSILON:
                return True
        return False

    def _has_vertical_wall(self, parsing: ParsingOutput, x: float, top: float, bottom: float) -> bool:
        for wall in parsing.walls:
            if self._orientation(wall) != 'vertical':
                continue
            if abs(wall.x1 - x) > EPSILON:
                continue
            if wall.y1 <= top + EPSILON and wall.y2 >= bottom - EPSILON:
                return True
        return False

    def _get_node_id(
        self,
        point: tuple[float, float],
        lookup: dict[tuple[float, float], int],
        nodes: list[GeometryNode],
        next_node_id: int,
    ) -> tuple[int, int]:
        normalized = (round(point[0], 3), round(point[1], 3))
        if normalized in lookup:
            return lookup[normalized], next_node_id
        lookup[normalized] = next_node_id
        nodes.append(GeometryNode(id=next_node_id, x=normalized[0], y=normalized[1]))
        return next_node_id, next_node_id + 1

    def _node_point(self, node_id: int, nodes: list[GeometryNode]) -> tuple[float, float]:
        node = next(node for node in nodes if node.id == node_id)
        return node.x, node.y

    def _is_extreme_point(self, point: tuple[float, float], nodes: list[GeometryNode]) -> bool:
        xs = [node.x for node in nodes]
        ys = [node.y for node in nodes]
        return (
            abs(point[0] - min(xs)) < EPSILON
            or abs(point[0] - max(xs)) < EPSILON
            or abs(point[1] - min(ys)) < EPSILON
            or abs(point[1] - max(ys)) < EPSILON
        )

    def _orientation(self, wall) -> str:
        return 'horizontal' if abs(wall.x2 - wall.x1) >= abs(wall.y2 - wall.y1) else 'vertical'

    def _segment_length(self, start: tuple[float, float], end: tuple[float, float]) -> float:
        return round(abs(end[0] - start[0]) + abs(end[1] - start[1]), 3)

    def _polygon_area(self, points: list[list[float]]) -> float:
        area = 0.0
        for current, nxt in zip(points, points[1:]):
            area += current[0] * nxt[1] - nxt[0] * current[1]
        return abs(area) / 2

    def _clamp(self, value: float, lower: float, upper: float) -> float:
        return max(lower, min(value, upper))
