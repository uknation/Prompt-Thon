from __future__ import annotations

import logging
from collections import defaultdict

from ..schemas.parsing_schema import ParsedWall, ParsingOutput
from ..schemas.validation_schema import ValidationIssue, ValidationOutput

logger = logging.getLogger(__name__)

SNAP_EPSILON = 0.18
MERGE_EPSILON = 0.22
MIN_WALL_LENGTH = 0.35


class ValidationService:
    """Geometry hygiene layer between parsing and reconstruction."""

    def validate(self, parsing: ParsingOutput) -> ValidationOutput:
        logger.info('Validating parsed geometry with %s walls.', len(parsing.walls))
        walls = [wall.model_dump() if hasattr(wall, 'model_dump') else wall.dict() for wall in parsing.walls]
        snapped_walls, snapped_points = self._snap_points(walls)
        merged_walls = self._merge_collinear(snapped_walls)
        corrected_walls, resolved_intersections, dangling_fixed = self._fix_connectivity(merged_walls)
        corrected_walls = [wall for wall in corrected_walls if self._length(wall) >= MIN_WALL_LENGTH]

        corrections = []
        if snapped_points:
            corrections.append(f'Snapped {snapped_points} close endpoints to a shared grid.')
        if len(merged_walls) < len(snapped_walls):
            corrections.append(f'Merged {len(snapped_walls) - len(merged_walls)} overlapping wall segments.')
        if resolved_intersections:
            corrections.append(f'Resolved {resolved_intersections} wall intersection candidates.')
        if dangling_fixed:
            corrections.append(f'Extended {dangling_fixed} dangling endpoints into nearby structural connections.')

        issues = self._build_issues(corrected_walls)
        status = 'passed'
        if any(issue.severity == 'error' for issue in issues):
            status = 'error'
        elif issues:
            status = 'warning'

        validated = ParsingOutput(
            walls=[ParsedWall(**wall) for wall in corrected_walls],
            openings=parsing.openings,
            rawContours=parsing.raw_contours,
            confidence=parsing.confidence,
        )
        return ValidationOutput(
            parsed=validated,
            status=status,
            corrections=corrections,
            issues=issues,
            snapped_points=snapped_points,
            resolved_intersections=resolved_intersections,
            dangling_walls_fixed=dangling_fixed,
        )

    def _snap_points(self, walls: list[dict]) -> tuple[list[dict], int]:
        xs = [coordinate for wall in walls for coordinate in (wall['x1'], wall['x2'])]
        ys = [coordinate for wall in walls for coordinate in (wall['y1'], wall['y2'])]
        snapped_x = self._cluster_axis(xs)
        snapped_y = self._cluster_axis(ys)

        changes = 0
        next_walls = []
        for wall in walls:
            x1 = self._nearest(snapped_x, wall['x1'])
            x2 = self._nearest(snapped_x, wall['x2'])
            y1 = self._nearest(snapped_y, wall['y1'])
            y2 = self._nearest(snapped_y, wall['y2'])
            changes += sum(
                1 for before, after in ((wall['x1'], x1), (wall['x2'], x2), (wall['y1'], y1), (wall['y2'], y2))
                if abs(before - after) > 1e-6
            )

            if abs(x2 - x1) >= abs(y2 - y1):
                average_y = round((y1 + y2) / 2, 3)
                y1 = average_y
                y2 = average_y
                x1, x2 = sorted((x1, x2))
            else:
                average_x = round((x1 + x2) / 2, 3)
                x1 = average_x
                x2 = average_x
                y1, y2 = sorted((y1, y2))

            next_walls.append(
                {
                    **wall,
                    'x1': round(x1, 3),
                    'y1': round(y1, 3),
                    'x2': round(x2, 3),
                    'y2': round(y2, 3),
                }
            )
        return next_walls, changes

    def _merge_collinear(self, walls: list[dict]) -> list[dict]:
        buckets: dict[tuple[str, int, float], list[dict]] = defaultdict(list)
        for wall in walls:
            orientation = 'horizontal' if abs(wall['x2'] - wall['x1']) >= abs(wall['y2'] - wall['y1']) else 'vertical'
            axis = wall['y1'] if orientation == 'horizontal' else wall['x1']
            thickness = round(wall.get('thickness', 0.2), 3)
            buckets[(orientation, round(axis / MERGE_EPSILON), thickness)].append({**wall, 'orientation': orientation})

        merged: list[dict] = []
        for bucket in buckets.values():
            bucket.sort(key=lambda item: item['x1'] if item['orientation'] == 'horizontal' else item['y1'])
            current = bucket[0]
            for segment in bucket[1:]:
                if current['orientation'] == 'horizontal' and segment['x1'] <= current['x2'] + MERGE_EPSILON:
                    current['x2'] = max(current['x2'], segment['x2'])
                    continue
                if current['orientation'] == 'vertical' and segment['y1'] <= current['y2'] + MERGE_EPSILON:
                    current['y2'] = max(current['y2'], segment['y2'])
                    continue
                merged.append(current)
                current = segment
            merged.append(current)
        return [{key: value for key, value in wall.items() if key != 'orientation'} for wall in merged]

    def _fix_connectivity(self, walls: list[dict]) -> tuple[list[dict], int, int]:
        resolved_intersections = 0
        dangling_fixed = 0
        for wall in walls:
            if self._orientation(wall) != 'horizontal':
                continue
            for other in walls:
                if self._orientation(other) != 'vertical':
                    continue
                crosses_x = wall['x1'] - SNAP_EPSILON <= other['x1'] <= wall['x2'] + SNAP_EPSILON
                crosses_y = other['y1'] - SNAP_EPSILON <= wall['y1'] <= other['y2'] + SNAP_EPSILON
                if not (crosses_x and crosses_y):
                    continue
                if abs(other['y1'] - wall['y1']) <= SNAP_EPSILON:
                    other['y1'] = wall['y1']
                    dangling_fixed += 1
                if abs(other['y2'] - wall['y1']) <= SNAP_EPSILON:
                    other['y2'] = wall['y1']
                    dangling_fixed += 1
                if abs(wall['x1'] - other['x1']) <= SNAP_EPSILON:
                    wall['x1'] = other['x1']
                    dangling_fixed += 1
                if abs(wall['x2'] - other['x1']) <= SNAP_EPSILON:
                    wall['x2'] = other['x1']
                    dangling_fixed += 1
                resolved_intersections += 1
        return walls, resolved_intersections, dangling_fixed

    def _build_issues(self, walls: list[dict]) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        if len(walls) < 4:
            issues.append(
                ValidationIssue(
                    code='too_few_walls',
                    severity='error',
                    message='At least four structural walls are required.',
                    element_ids=[],
                )
            )

        endpoint_usage: dict[tuple[float, float], int] = defaultdict(int)
        for wall in walls:
            endpoint_usage[(wall['x1'], wall['y1'])] += 1
            endpoint_usage[(wall['x2'], wall['y2'])] += 1

        dangling = []
        for wall in walls:
            if endpoint_usage[(wall['x1'], wall['y1'])] == 1:
                dangling.append(wall['id'])
            if endpoint_usage[(wall['x2'], wall['y2'])] == 1:
                dangling.append(wall['id'])
        if dangling:
            issues.append(
                ValidationIssue(
                    code='dangling_walls',
                    severity='warning',
                    message='Some walls still terminate without a structural junction after auto-correction.',
                    element_ids=sorted(set(dangling)),
                )
            )
        return issues

    def _cluster_axis(self, values: list[float]) -> list[float]:
        if not values:
            return []
        ordered = sorted(values)
        clusters: list[list[float]] = [[ordered[0]]]
        for value in ordered[1:]:
            if abs(value - clusters[-1][-1]) <= SNAP_EPSILON:
                clusters[-1].append(value)
            else:
                clusters.append([value])
        return [round(sum(cluster) / len(cluster), 3) for cluster in clusters]

    def _nearest(self, clusters: list[float], value: float) -> float:
        return min(clusters, key=lambda cluster: abs(cluster - value))

    def _orientation(self, wall: dict) -> str:
        return 'horizontal' if abs(wall['x2'] - wall['x1']) >= abs(wall['y2'] - wall['y1']) else 'vertical'

    def _length(self, wall: dict) -> float:
        return abs(wall['x2'] - wall['x1']) + abs(wall['y2'] - wall['y1'])
