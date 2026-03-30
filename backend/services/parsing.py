from __future__ import annotations

import logging
import math
import os
from typing import Iterable

import cv2
import numpy as np

from ..schemas.input_schema import StructuralPlanInput
from ..schemas.parsing_schema import ParsedOpening, ParsedWall, ParsingOutput, RawContour

logger = logging.getLogger(__name__)
LINE_AXIS_TOLERANCE = 0.012
LINE_GAP_TOLERANCE = 0.02
BOUNDARY_LINE_TOLERANCE = 0.035

try:
    import easyocr  # type: ignore
except Exception:  # pragma: no cover
    easyocr = None

_OCR_READER = None


class ParsingService:
    """Stage 1 parser that normalizes either structured plans or raw images."""

    def parse_plan(self, plan: StructuralPlanInput) -> ParsingOutput:
        logger.info('Parsing structured plan input: %s', plan.name)
        segments = list(plan.wall_segments) or self._build_segments_from_shells(plan)
        if not segments:
            raise ValueError('Plan input does not contain any wall geometry.')

        metric_segments = []
        for index, segment in enumerate(segments, start=1):
            metric_segments.append(
                ParsedWall(
                    id=index,
                    x1=segment.x1 * plan.scale,
                    y1=segment.y1 * plan.scale,
                    x2=segment.x2 * plan.scale,
                    y2=segment.y2 * plan.scale,
                    thickness=segment.thickness or 0.2,
                )
            )

        min_x = min(min(wall.x1, wall.x2) for wall in metric_segments)
        min_y = min(min(wall.y1, wall.y2) for wall in metric_segments)
        walls = [
            ParsedWall(
                id=wall.id,
                x1=round(wall.x1 - min_x, 3),
                y1=round(wall.y1 - min_y, 3),
                x2=round(wall.x2 - min_x, 3),
                y2=round(wall.y2 - min_y, 3),
                thickness=round(wall.thickness, 3),
            )
            for wall in metric_segments
        ]

        openings = []
        for index, opening in enumerate(plan.openings, start=1):
            openings.append(
                ParsedOpening(
                    id=index,
                    type=opening.type,
                    hostOrientation=opening.host_orientation,
                    x=round(opening.x * plan.scale - min_x, 3),
                    y=round(opening.y * plan.scale - min_y, 3),
                    width=round(opening.width, 3),
                    height=round(opening.height, 3),
                )
            )

        raw_contours: list[RawContour] = []
        contour_id = 1
        for shell in plan.outer_walls:
            raw_contours.append(
                RawContour(
                    id=contour_id,
                    label='outer-shell',
                    points=self._rect_to_points(shell.x * plan.scale - min_x, shell.y * plan.scale - min_y, shell.w * plan.scale, shell.h * plan.scale),
                )
            )
            contour_id += 1
        for room in plan.rooms:
            raw_contours.append(
                RawContour(
                    id=contour_id,
                    label=room.name,
                    points=self._rect_to_points(room.x * plan.scale - min_x, room.y * plan.scale - min_y, room.w * plan.scale, room.h * plan.scale),
                )
            )
            contour_id += 1

        confidence = min(0.99, round(0.72 + len(walls) * 0.012 + len(openings) * 0.008, 2))
        return ParsingOutput(walls=walls, openings=openings, rawContours=raw_contours, confidence=confidence)

    def parse_image(self, image_bytes: bytes) -> ParsingOutput:
        logger.info('Parsing uploaded plan image.')
        image = self._decode_image(image_bytes)
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        wall_mask = self._build_wall_mask(gray)
        opening_mask = self._build_opening_mask(gray)
        text_mask = self._build_text_mask(image, gray, wall_mask)

        if np.count_nonzero(text_mask):
            wall_mask = cv2.bitwise_and(wall_mask, cv2.bitwise_not(text_mask))

        plan_box = self._detect_plan_box(wall_mask)
        normalized_lines = self._refine_detected_lines(self._detect_wall_lines(wall_mask, plan_box), plan_box)
        room_boxes = self._detect_room_boxes(wall_mask, plan_box)
        windows = self._detect_openings(opening_mask, plan_box, label='window')
        doors = self._detect_doors(gray, wall_mask, plan_box)

        width_px = max(plan_box['w'] * image.shape[1], 1.0)
        scale_m_per_px = 12.0 / width_px
        shell_width_m = round(plan_box['w'] * image.shape[1] * scale_m_per_px, 3)
        shell_height_m = round(plan_box['h'] * image.shape[0] * scale_m_per_px, 3)

        walls = [
            ParsedWall(id=1, x1=0.0, y1=0.0, x2=shell_width_m, y2=0.0, thickness=0.3),
            ParsedWall(id=2, x1=shell_width_m, y1=0.0, x2=shell_width_m, y2=shell_height_m, thickness=0.3),
            ParsedWall(id=3, x1=shell_width_m, y1=shell_height_m, x2=0.0, y2=shell_height_m, thickness=0.3),
            ParsedWall(id=4, x1=0.0, y1=shell_height_m, x2=0.0, y2=0.0, thickness=0.3),
        ]

        next_wall_id = 5
        for line in normalized_lines:
            local = self._normalized_line_to_local_metric(line, plan_box, image.shape[1], image.shape[0], scale_m_per_px)
            if self._segment_length(local['x1'], local['y1'], local['x2'], local['y2']) < 0.6:
                continue
            walls.append(
                ParsedWall(
                    id=next_wall_id,
                    x1=local['x1'],
                    y1=local['y1'],
                    x2=local['x2'],
                    y2=local['y2'],
                    thickness=0.16,
                )
            )
            next_wall_id += 1

        aligned_openings = self._align_openings_to_walls([*doors, *windows], walls)
        raw_contours = [
            RawContour(id=1, label='outer-shell', points=self._rect_to_points(0.0, 0.0, shell_width_m, shell_height_m)),
        ]
        for index, room in enumerate(room_boxes, start=2):
            raw_contours.append(
                RawContour(
                    id=index,
                    label='room-contour',
                    points=self._rect_to_points(room['x'], room['y'], room['w'], room['h']),
                )
            )

        openings = []
        next_opening_id = 1
        for opening in aligned_openings:
            openings.append(
                ParsedOpening(
                    id=next_opening_id,
                    type=opening['type'],
                    hostOrientation=opening['hostOrientation'],
                    x=opening['x'],
                    y=opening['y'],
                    width=opening['width'],
                    height=opening['height'],
                )
            )
            next_opening_id += 1

        confidence = min(0.95, round(0.5 + len(normalized_lines) * 0.028 + len(room_boxes) * 0.04 + len(openings) * 0.03, 2))
        return ParsingOutput(walls=walls, openings=openings, rawContours=raw_contours, confidence=confidence)

    def _build_segments_from_shells(self, plan: StructuralPlanInput):
        segments = []
        for shell in plan.outer_walls:
            segments.extend(
                [
                    {'x1': shell.x, 'y1': shell.y, 'x2': shell.x + shell.w, 'y2': shell.y, 'thickness': 0.3},
                    {'x1': shell.x + shell.w, 'y1': shell.y, 'x2': shell.x + shell.w, 'y2': shell.y + shell.h, 'thickness': 0.3},
                    {'x1': shell.x + shell.w, 'y1': shell.y + shell.h, 'x2': shell.x, 'y2': shell.y + shell.h, 'thickness': 0.3},
                    {'x1': shell.x, 'y1': shell.y + shell.h, 'x2': shell.x, 'y2': shell.y, 'thickness': 0.3},
                ]
            )
        return [type('Segment', (), segment) for segment in segments]

    def _decode_image(self, content: bytes) -> np.ndarray:
        array = np.frombuffer(content, dtype=np.uint8)
        image = cv2.imdecode(array, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError('Could not decode image payload.')
        return image

    def _build_wall_mask(self, gray: np.ndarray) -> np.ndarray:
        adaptive = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 4)
        _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        combined = cv2.bitwise_or(adaptive, otsu)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        cleaned = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel, iterations=2)
        return cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))

    def _build_opening_mask(self, gray: np.ndarray) -> np.ndarray:
        adaptive = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 19, 3)
        return cv2.morphologyEx(adaptive, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))

    def _build_text_mask(self, image: np.ndarray, gray: np.ndarray, wall_mask: np.ndarray) -> np.ndarray:
        ocr_mask = self._build_ocr_text_mask(image)
        heuristic_mask = self._build_heuristic_text_mask(gray, wall_mask)
        merged = cv2.bitwise_or(ocr_mask, heuristic_mask)
        if np.count_nonzero(merged) == 0:
            return merged
        return cv2.dilate(merged, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)), iterations=1)

    def _build_ocr_text_mask(self, image: np.ndarray) -> np.ndarray:
        mask = np.zeros(image.shape[:2], dtype=np.uint8)
        reader = self._get_ocr_reader()
        if reader is None:
            return mask

        try:
            detections = reader.readtext(image, detail=1, paragraph=False)
        except Exception as exc:  # pragma: no cover
            logger.warning('EasyOCR text suppression failed: %s', exc)
            return mask

        for bbox, text, confidence in detections:
            normalized_text = ''.join(character for character in str(text) if character.isalnum())
            if len(normalized_text) < 2 or float(confidence) < 0.15:
                continue
            points = np.array(bbox, dtype=np.int32)
            x, y, w, h = cv2.boundingRect(points)
            padding = max(2, int(min(w, h) * 0.3))
            x0 = max(0, x - padding)
            y0 = max(0, y - padding)
            x1 = min(mask.shape[1], x + w + padding)
            y1 = min(mask.shape[0], y + h + padding)
            cv2.rectangle(mask, (x0, y0), (x1, y1), 255, thickness=-1)
        return mask

    def _build_heuristic_text_mask(self, gray: np.ndarray, wall_mask: np.ndarray) -> np.ndarray:
        adaptive = cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            17,
            3,
        )
        axes = self._extract_structural_axes(wall_mask)
        component_count, labels, stats, _ = cv2.connectedComponentsWithStats(adaptive, connectivity=8)
        mask = np.zeros_like(gray)
        height, width = gray.shape[:2]
        max_width = max(30, int(width * 0.18))
        max_height = max(40, int(height * 0.14))
        max_area = max(180, int(height * width * 0.012))

        for label in range(1, component_count):
            x = stats[label, cv2.CC_STAT_LEFT]
            y = stats[label, cv2.CC_STAT_TOP]
            w = stats[label, cv2.CC_STAT_WIDTH]
            h = stats[label, cv2.CC_STAT_HEIGHT]
            area = stats[label, cv2.CC_STAT_AREA]

            if area < 8 or area > max_area:
                continue
            if w > max_width or h > max_height:
                continue
            if w < 2 or h < 4:
                continue

            bbox_area = max(w * h, 1)
            fill_ratio = area / bbox_area
            aspect_ratio = w / max(h, 1)
            axis_overlap = np.count_nonzero(axes[y:y + h, x:x + w]) / bbox_area

            # Text strokes are usually compact, non-elongated, and much smaller than wall runs.
            is_compact_text = (
                0.18 <= aspect_ratio <= 4.2
                and 0.12 <= fill_ratio <= 0.82
                and max(w, h) <= max_width
                and min(w, h) >= 6
            )
            is_axis_light = axis_overlap < 0.9
            if is_compact_text and is_axis_light:
                mask[labels == label] = 255

        mask = cv2.morphologyEx(
            mask,
            cv2.MORPH_CLOSE,
            cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)),
            iterations=1,
        )
        return cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)), iterations=1)

    def _detect_plan_box(self, binary: np.ndarray) -> dict[str, float]:
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        height, width = binary.shape[:2]
        if not contours:
            return {'x': 0.08, 'y': 0.08, 'w': 0.84, 'h': 0.84}

        contour = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(contour)
        pad_x = int(width * 0.02)
        pad_y = int(height * 0.02)
        x0 = max(0, x - pad_x)
        y0 = max(0, y - pad_y)
        x1 = min(width, x + w + pad_x)
        y1 = min(height, y + h + pad_y)
        return {'x': x0 / width, 'y': y0 / height, 'w': (x1 - x0) / width, 'h': (y1 - y0) / height}

    def _detect_wall_lines(self, binary: np.ndarray, plan_box: dict[str, float]) -> list[dict[str, float]]:
        structural = self._extract_structural_axes(binary)
        lines = cv2.HoughLinesP(structural, 1, np.pi / 180, threshold=70, minLineLength=40, maxLineGap=14)
        if lines is None:
            return []

        height, width = binary.shape[:2]
        x0 = plan_box['x'] * width
        y0 = plan_box['y'] * height
        x1 = (plan_box['x'] + plan_box['w']) * width
        y1 = (plan_box['y'] + plan_box['h']) * height
        normalized: list[dict[str, float]] = []
        for candidate in lines[:180]:
            px1, py1, px2, py2 = candidate[0]
            if px1 < x0 and px2 < x0 or px1 > x1 and px2 > x1:
                continue
            if py1 < y0 and py2 < y0 or py1 > y1 and py2 > y1:
                continue
            if abs(px2 - px1) > abs(py2 - py1):
                py = round((py1 + py2) / 2)
                normalized.append({'x1': px1 / width, 'y1': py / height, 'x2': px2 / width, 'y2': py / height})
            else:
                px = round((px1 + px2) / 2)
                normalized.append({'x1': px / width, 'y1': py1 / height, 'x2': px / width, 'y2': py2 / height})
        return self._dedupe_lines(normalized)

    def _refine_detected_lines(self, lines: list[dict[str, float]], plan_box: dict[str, float]) -> list[dict[str, float]]:
        merged = self._merge_parallel_lines(lines)
        refined = [line for line in merged if not self._is_boundary_duplicate_line(line, plan_box)]
        return self._dedupe_lines(refined)

    def _detect_room_boxes(self, binary: np.ndarray, plan_box: dict[str, float]) -> list[dict[str, float]]:
        height, width = binary.shape[:2]
        x0 = int(plan_box['x'] * width)
        y0 = int(plan_box['y'] * height)
        x1 = int((plan_box['x'] + plan_box['w']) * width)
        y1 = int((plan_box['y'] + plan_box['h']) * height)
        roi = binary[y0:y1, x0:x1]
        if roi.size == 0:
            return []

        spaces = cv2.bitwise_not(cv2.dilate(roi, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)), iterations=1))
        contours, _ = cv2.findContours(spaces, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        scale_m_per_px = 12.0 / max(x1 - x0, 1)
        rooms = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if w < 18 or h < 18:
                continue
            rooms.append({'x': round(x * scale_m_per_px, 3), 'y': round(y * scale_m_per_px, 3), 'w': round(w * scale_m_per_px, 3), 'h': round(h * scale_m_per_px, 3)})
        rooms.sort(key=lambda item: (item['y'], item['x']))
        return rooms[:20]

    def _detect_openings(self, binary: np.ndarray, plan_box: dict[str, float], label: str) -> list[dict[str, float | str]]:
        contours, _ = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        height, width = binary.shape[:2]
        scale_m_per_px = 12.0 / max(plan_box['w'] * width, 1)
        openings: list[dict[str, float | str]] = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if w < 12 or h < 12:
                continue
            if max(w / max(h, 1), h / max(w, 1)) < 2.8:
                continue
            local_x = round((x - plan_box['x'] * width) * scale_m_per_px, 3)
            local_y = round((y - plan_box['y'] * height) * scale_m_per_px, 3)
            openings.append(
                {
                    'type': label,
                    'hostOrientation': 'horizontal' if w >= h else 'vertical',
                    'x': local_x + round((w * scale_m_per_px) / 2, 3),
                    'y': local_y + round((h * scale_m_per_px) / 2, 3),
                    'width': round(max(w, h) * scale_m_per_px, 3),
                    'height': 2.1 if label != 'window' else 1.2,
                }
            )
        return openings[:16]

    def _detect_doors(self, gray: np.ndarray, wall_mask: np.ndarray, plan_box: dict[str, float]) -> list[dict[str, float | str]]:
        height, width = gray.shape[:2]
        x0 = int(plan_box['x'] * width)
        y0 = int(plan_box['y'] * height)
        x1 = int((plan_box['x'] + plan_box['w']) * width)
        y1 = int((plan_box['y'] + plan_box['h']) * height)
        roi = gray[y0:y1, x0:x1]
        if roi.size == 0:
            return []

        scale_m_per_px = 12.0 / max(x1 - x0, 1)
        edges = cv2.Canny(roi, 40, 120)
        dilated_walls = cv2.dilate(wall_mask[y0:y1, x0:x1], cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7)), iterations=1)
        symbols = cv2.bitwise_and(edges, cv2.bitwise_not(dilated_walls))
        contours, _ = cv2.findContours(symbols, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        doors: list[dict[str, float | str]] = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < 60 or area > 2200:
                continue
            x, y, w, h = cv2.boundingRect(contour)
            if w < 10 or h < 10:
                continue
            if max(w / max(h, 1), h / max(w, 1)) > 3.0:
                continue
            patch = dilated_walls[max(y - 2, 0):min(y + h + 2, dilated_walls.shape[0]), max(x - 2, 0):min(x + w + 2, dilated_walls.shape[1])]
            if np.count_nonzero(patch) == 0:
                continue
            doors.append(
                {
                    'type': 'door',
                    'hostOrientation': 'horizontal' if w >= h else 'vertical',
                    'x': round((x + w / 2) * scale_m_per_px, 3),
                    'y': round((y + h / 2) * scale_m_per_px, 3),
                    'width': round(max(w, h) * scale_m_per_px, 3),
                    'height': 2.1,
                }
            )
        return doors[:12]

    def _align_openings_to_walls(self, openings: list[dict[str, float | str]], walls: list[ParsedWall]) -> list[dict[str, float | str]]:
        aligned: list[dict[str, float | str]] = []
        for opening in openings:
            host = self._match_opening_wall(opening, walls)
            if host is None:
                continue

            opening_type = str(opening['type'])
            host_orientation = str(opening['hostOrientation'])
            width = round(float(opening['width']), 3)
            height = round(float(opening['height']), 3)
            x = float(opening['x'])
            y = float(opening['y'])

            if host_orientation == 'horizontal':
                half_width = width / 2
                min_x = min(host.x1, host.x2) + min(half_width, 0.08)
                max_x = max(host.x1, host.x2) - min(half_width, 0.08)
                x = self._clamp(x, min_x, max_x) if min_x <= max_x else x
                y = host.y1
            else:
                half_width = width / 2
                min_y = min(host.y1, host.y2) + min(half_width, 0.08)
                max_y = max(host.y1, host.y2) - min(half_width, 0.08)
                y = self._clamp(y, min_y, max_y) if min_y <= max_y else y
                x = host.x1

            aligned.append(
                {
                    'type': opening_type,
                    'hostOrientation': host_orientation,
                    'x': round(x, 3),
                    'y': round(y, 3),
                    'width': width,
                    'height': height,
                }
            )

        return self._dedupe_openings(aligned)

    def _extract_structural_axes(self, binary: np.ndarray) -> np.ndarray:
        height, width = binary.shape[:2]
        vertical = cv2.morphologyEx(binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(12, height // 14))))
        horizontal = cv2.morphologyEx(binary, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (max(12, width // 14), 1)))
        return cv2.bitwise_or(vertical, horizontal)

    def _normalized_line_to_local_metric(
        self,
        line: dict[str, float],
        plan_box: dict[str, float],
        width: int,
        height: int,
        scale_m_per_px: float,
    ) -> dict[str, float]:
        x0 = plan_box['x'] * width
        y0 = plan_box['y'] * height
        px1 = line['x1'] * width - x0
        py1 = line['y1'] * height - y0
        px2 = line['x2'] * width - x0
        py2 = line['y2'] * height - y0
        return {'x1': round(px1 * scale_m_per_px, 3), 'y1': round(py1 * scale_m_per_px, 3), 'x2': round(px2 * scale_m_per_px, 3), 'y2': round(py2 * scale_m_per_px, 3)}

    def _rect_to_points(self, x: float, y: float, w: float, h: float) -> list[list[float]]:
        return [
            [round(x, 3), round(y, 3)],
            [round(x + w, 3), round(y, 3)],
            [round(x + w, 3), round(y + h, 3)],
            [round(x, 3), round(y + h, 3)],
            [round(x, 3), round(y, 3)],
        ]

    def _segment_length(self, x1: float, y1: float, x2: float, y2: float) -> float:
        return math.hypot(x2 - x1, y2 - y1)

    def _dedupe_lines(self, lines: Iterable[dict[str, float]]) -> list[dict[str, float]]:
        unique: list[dict[str, float]] = []
        for line in lines:
            if any(self._line_distance(line, existing) < 0.015 for existing in unique):
                continue
            unique.append(line)
        return unique

    def _merge_parallel_lines(self, lines: list[dict[str, float]]) -> list[dict[str, float]]:
        merged: list[dict[str, float]] = []
        for orientation in ('horizontal', 'vertical'):
            groups: list[dict[str, list[tuple[float, float]] | list[float]]] = []
            for line in lines:
                line_orientation = 'horizontal' if abs(line['x2'] - line['x1']) >= abs(line['y2'] - line['y1']) else 'vertical'
                if line_orientation != orientation:
                    continue
                axis = (line['y1'] + line['y2']) / 2 if orientation == 'horizontal' else (line['x1'] + line['x2']) / 2
                start = min(line['x1'], line['x2']) if orientation == 'horizontal' else min(line['y1'], line['y2'])
                end = max(line['x1'], line['x2']) if orientation == 'horizontal' else max(line['y1'], line['y2'])
                target_group = None
                for group in groups:
                    group_axis = sum(group['axes']) / len(group['axes'])
                    if abs(axis - group_axis) <= LINE_AXIS_TOLERANCE:
                        target_group = group
                        break
                if target_group is None:
                    target_group = {'axes': [], 'intervals': []}
                    groups.append(target_group)
                target_group['axes'].append(axis)
                target_group['intervals'].append((start, end))

            for group in groups:
                axis = round(sum(group['axes']) / len(group['axes']), 4)
                intervals = sorted(group['intervals'])
                current_start, current_end = intervals[0]
                for start, end in intervals[1:]:
                    if start <= current_end + LINE_GAP_TOLERANCE:
                        current_end = max(current_end, end)
                    else:
                        merged.append(self._build_line_from_interval(orientation, axis, current_start, current_end))
                        current_start, current_end = start, end
                merged.append(self._build_line_from_interval(orientation, axis, current_start, current_end))
        return merged

    def _build_line_from_interval(self, orientation: str, axis: float, start: float, end: float) -> dict[str, float]:
        if orientation == 'horizontal':
            return {'x1': round(start, 4), 'y1': round(axis, 4), 'x2': round(end, 4), 'y2': round(axis, 4)}
        return {'x1': round(axis, 4), 'y1': round(start, 4), 'x2': round(axis, 4), 'y2': round(end, 4)}

    def _is_boundary_duplicate_line(self, line: dict[str, float], plan_box: dict[str, float]) -> bool:
        orientation = 'horizontal' if abs(line['x2'] - line['x1']) >= abs(line['y2'] - line['y1']) else 'vertical'
        if orientation == 'horizontal':
            local_axis = (line['y1'] - plan_box['y']) / max(plan_box['h'], 1e-6)
            span = abs(line['x2'] - line['x1']) / max(plan_box['w'], 1e-6)
        else:
            local_axis = (line['x1'] - plan_box['x']) / max(plan_box['w'], 1e-6)
            span = abs(line['y2'] - line['y1']) / max(plan_box['h'], 1e-6)
        near_boundary = local_axis <= BOUNDARY_LINE_TOLERANCE or local_axis >= 1 - BOUNDARY_LINE_TOLERANCE
        return near_boundary and span >= 0.72

    def _match_opening_wall(self, opening: dict[str, float | str], walls: list[ParsedWall]) -> ParsedWall | None:
        target_orientation = str(opening['hostOrientation'])
        target_x = float(opening['x'])
        target_y = float(opening['y'])
        best_wall = None
        best_score = float('inf')
        for wall in walls:
            wall_orientation = 'horizontal' if abs(wall.x2 - wall.x1) >= abs(wall.y2 - wall.y1) else 'vertical'
            if wall_orientation != target_orientation:
                continue
            if target_orientation == 'horizontal':
                axis_distance = abs(target_y - wall.y1)
                if target_x < min(wall.x1, wall.x2) - 0.5 or target_x > max(wall.x1, wall.x2) + 0.5:
                    continue
                score = axis_distance + min(abs(target_x - wall.x1), abs(target_x - wall.x2)) * 0.01
            else:
                axis_distance = abs(target_x - wall.x1)
                if target_y < min(wall.y1, wall.y2) - 0.5 or target_y > max(wall.y1, wall.y2) + 0.5:
                    continue
                score = axis_distance + min(abs(target_y - wall.y1), abs(target_y - wall.y2)) * 0.01
            if axis_distance > max(0.42, wall.thickness * 2.2):
                continue
            if score < best_score:
                best_score = score
                best_wall = wall
        return best_wall

    def _dedupe_openings(self, openings: list[dict[str, float | str]]) -> list[dict[str, float | str]]:
        deduped: list[dict[str, float | str]] = []
        for opening in openings:
            duplicate = next(
                (
                    existing
                    for existing in deduped
                    if existing['type'] == opening['type']
                    and existing['hostOrientation'] == opening['hostOrientation']
                    and abs(float(existing['x']) - float(opening['x'])) < 0.28
                    and abs(float(existing['y']) - float(opening['y'])) < 0.28
                ),
                None,
            )
            if duplicate is None:
                deduped.append(opening)
                continue
            if float(opening['width']) > float(duplicate['width']):
                duplicate.update(opening)
        return deduped

    def _line_distance(self, first: dict[str, float], second: dict[str, float]) -> float:
        return max(abs(first['x1'] - second['x1']), abs(first['y1'] - second['y1']), abs(first['x2'] - second['x2']), abs(first['y2'] - second['y2']))

    def _clamp(self, value: float, lower: float, upper: float) -> float:
        return max(lower, min(value, upper))

    def _get_ocr_reader(self):
        global _OCR_READER
        if os.getenv('PARSER_ENABLE_OCR', 'false').strip().lower() not in {'1', 'true', 'yes', 'on'}:
            return None
        if easyocr is None:
            return None
        if _OCR_READER is None:  # pragma: no branch
            try:
                _OCR_READER = easyocr.Reader(['en'], gpu=False)
            except Exception as exc:  # pragma: no cover
                logger.warning('EasyOCR reader unavailable, falling back to heuristic text suppression: %s', exc)
                _OCR_READER = False
        if _OCR_READER is False:
            return None
        return _OCR_READER
