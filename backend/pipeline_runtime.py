from __future__ import annotations

import copy
import math
import re
from typing import Any

MATERIALS: dict[str, dict[str, Any]] = {
    'AAC Blocks': {
        'cost': 1,
        'strength': 2,
        'durability': 3,
        'embodiedCarbon': 2,
        'bestUse': 'Partition walls',
        'color': '#7fb3d3',
    },
    'Red Brick': {
        'cost': 2,
        'strength': 3,
        'durability': 2,
        'embodiedCarbon': 3,
        'bestUse': 'Load-bearing walls',
        'color': '#c0392b',
    },
    'RCC': {
        'cost': 3,
        'strength': 5,
        'durability': 5,
        'embodiedCarbon': 5,
        'bestUse': 'Columns, beams, slabs',
        'color': '#7f8c8d',
    },
    'Steel Frame': {
        'cost': 3,
        'strength': 5,
        'durability': 5,
        'embodiedCarbon': 4,
        'bestUse': 'Long-span systems',
        'color': '#2980b9',
    },
    'Hollow Concrete Block': {
        'cost': 1.5,
        'strength': 2,
        'durability': 2,
        'embodiedCarbon': 2.5,
        'bestUse': 'Non-structural walls',
        'color': '#95a5a6',
    },
    'Fly Ash Brick': {
        'cost': 1,
        'strength': 2.5,
        'durability': 3,
        'embodiedCarbon': 1.5,
        'bestUse': 'General walling',
        'color': '#d35400',
    },
    'Precast Concrete': {
        'cost': 2.5,
        'strength': 4,
        'durability': 5,
        'embodiedCarbon': 3.5,
        'bestUse': 'Factory-made structural units',
        'color': '#bdc3c7',
    },
}


def build_pipeline_artifacts(plan: dict[str, Any]) -> dict[str, Any]:
    next_plan = copy.deepcopy(plan)
    parsed = build_parsed_model(next_plan)
    geometry = build_geometry_model(parsed)
    model_stats = build_model_stats(geometry)
    material_analysis = build_material_analysis(geometry)
    report = build_explainability_report(next_plan, geometry, material_analysis)

    return {
        'plan': next_plan,
        'parsed': parsed,
        'geometry': geometry,
        'modelStats': model_stats,
        'materialAnalysis': material_analysis,
        'report': report,
    }


def build_report_payload(plan: dict[str, Any], prompt: str, geometry: dict[str, Any], material_analysis: dict[str, Any]) -> dict[str, Any]:
    return {
        'prompt': prompt,
        'plan': {
            'name': plan.get('name'),
            'description': plan.get('description'),
            'purpose': plan.get('purpose'),
            'planArea': plan.get('planArea'),
            'roomCount': len(plan.get('rooms', [])),
            'outerWallCount': len(plan.get('outerWalls', [])),
        },
        'geometry': {
            'roomCount': geometry['metrics']['roomCount'],
            'loadBearingCount': len(geometry['loadBearing']),
            'partitionCount': len(geometry['partition']),
            'junctionCount': len(geometry['junctions']),
            'maxSpan': geometry['maxSpan'],
            'efficiency': geometry['metrics']['efficiency'],
            'alerts': geometry['alerts'],
            'rooms': [
                {
                    'name': room['name'],
                    'area': room['area'],
                    'perimeter': room['perimeter'],
                    'span': room['span'],
                    'risk': room['risk'],
                }
                for room in geometry['rooms']
            ],
        },
        'materials': {
            'summary': material_analysis['summary'],
            'topSelections': material_analysis['topSelections'],
        },
    }


def build_parsed_model(plan: dict[str, Any]) -> dict[str, Any]:
    walls = build_wall_network(plan)
    openings = build_openings(plan, walls)
    return {
        'plan': plan,
        'rooms': plan.get('rooms', []),
        'walls': walls,
        'openings': openings,
    }


def build_wall_network(plan: dict[str, Any]) -> list[dict[str, Any]]:
    shells: list[dict[str, Any]] = []
    for shell in plan.get('outerWalls', []):
        shells.extend(
            [
                {'x1': shell['x'], 'y1': shell['y'], 'x2': shell['x'] + shell['w'], 'y2': shell['y'], 'type': 'load-bearing', 'thickness': 0.3},
                {'x1': shell['x'] + shell['w'], 'y1': shell['y'], 'x2': shell['x'] + shell['w'], 'y2': shell['y'] + shell['h'], 'type': 'load-bearing', 'thickness': 0.3},
                {'x1': shell['x'], 'y1': shell['y'] + shell['h'], 'x2': shell['x'] + shell['w'], 'y2': shell['y'] + shell['h'], 'type': 'load-bearing', 'thickness': 0.3},
                {'x1': shell['x'], 'y1': shell['y'], 'x2': shell['x'], 'y2': shell['y'] + shell['h'], 'type': 'load-bearing', 'thickness': 0.3},
            ]
        )

    room_edges: list[dict[str, Any]] = []
    for room in plan.get('rooms', []):
        room_edges.extend(
            [
                {'x1': room['x'], 'y1': room['y'], 'x2': room['x'] + room['w'], 'y2': room['y'], 'type': 'partition', 'thickness': 0.15},
                {'x1': room['x'] + room['w'], 'y1': room['y'], 'x2': room['x'] + room['w'], 'y2': room['y'] + room['h'], 'type': 'partition', 'thickness': 0.15},
                {'x1': room['x'], 'y1': room['y'] + room['h'], 'x2': room['x'] + room['w'], 'y2': room['y'] + room['h'], 'type': 'partition', 'thickness': 0.15},
                {'x1': room['x'], 'y1': room['y'], 'x2': room['x'], 'y2': room['y'] + room['h'], 'type': 'partition', 'thickness': 0.15},
            ]
        )

    source_segments = plan.get('wallSegments') or [*shells, *room_edges]
    merged: dict[str, dict[str, Any]] = {}
    next_id = 1

    for segment in source_segments:
        normalized = normalize_segment(segment)
        key = segment_key(normalized)
        existing = merged.get(key)

        if existing:
            existing['count'] += 1
            existing['type'] = 'load-bearing' if existing['type'] == 'load-bearing' or normalized.get('type') == 'load-bearing' else 'partition'
            existing['thickness'] = max(existing['thickness'], normalized.get('thickness', 0.15))
            continue

        merged[key] = {
            **normalized,
            'id': f'W{next_id}',
            'count': normalized.get('count', 1),
        }
        next_id += 1

    scale = float(plan.get('scale') or 0.04)
    walls = []
    for wall in merged.values():
        orientation = 'horizontal' if abs(wall['x2'] - wall['x1']) > abs(wall['y2'] - wall['y1']) else 'vertical'
        length = round(math.hypot(wall['x2'] - wall['x1'], wall['y2'] - wall['y1']) * scale, 2)
        walls.append(
            {
                **wall,
                'orientation': orientation,
                'length': length,
            }
        )

    return walls


def build_openings(plan: dict[str, Any], walls: list[dict[str, Any]]) -> list[dict[str, Any]]:
    explicit_openings = plan.get('openings') or []
    if explicit_openings:
        normalized = [{**opening, 'id': opening.get('id') or f'O{index + 1}'} for index, opening in enumerate(explicit_openings)]
        needs_doors = not any('door' in opening.get('type', '') for opening in normalized)
        needs_windows = not any(opening.get('type') == 'window' for opening in normalized)

        if not needs_doors and not needs_windows:
            return normalized

        fallback = [
            opening
            for opening in build_fallback_openings(plan, walls)
            if (needs_doors and 'door' in opening['type']) or (needs_windows and opening['type'] == 'window')
        ]
        return [*normalized, *fallback]

    return build_fallback_openings(plan, walls)


def build_fallback_openings(plan: dict[str, Any], walls: list[dict[str, Any]]) -> list[dict[str, Any]]:
    openings: list[dict[str, Any]] = []
    opening_id = 1
    shell = (plan.get('outerWalls') or [None])[0]

    if shell:
        openings.append(
            {
                'id': f'O{opening_id}',
                'type': 'main-door',
                'hostOrientation': 'horizontal',
                'x': shell['x'] + shell['w'] * 0.5,
                'y': shell['y'] + shell['h'],
                'width': 1.2,
            }
        )
        opening_id += 1

    for room in plan.get('rooms', []):
        room_center_x = room['x'] + room['w'] / 2
        room_center_y = room['y'] + room['h'] / 2
        is_windowed = bool(re.search(r'bed|living|great|primary', room.get('name', ''), flags=re.IGNORECASE))

        if is_windowed and shell:
            nearest_side = get_nearest_shell_side(room, shell)
            openings.append(
                {
                    'id': f'O{opening_id}',
                    'type': 'window',
                    'hostOrientation': nearest_side['orientation'],
                    'x': nearest_side.get('x', room_center_x),
                    'y': nearest_side.get('y', room_center_y),
                    'width': 1.4 if nearest_side['orientation'] == 'horizontal' else 1.2,
                }
            )
            opening_id += 1

    partition_candidates = [
        wall for wall in walls if wall['type'] == 'partition' and wall.get('count', 0) > 1 and wall['length'] > 1.1
    ]
    door_limit = max(2, min(6, len(plan.get('rooms', [])) - 1))
    for wall in partition_candidates[:door_limit]:
        openings.append(
            {
                'id': f'O{opening_id}',
                'type': 'door',
                'hostOrientation': wall['orientation'],
                'x': (wall['x1'] + wall['x2']) / 2,
                'y': (wall['y1'] + wall['y2']) / 2,
                'width': 0.9,
            }
        )
        opening_id += 1

    return openings


def normalize_segment(segment: dict[str, Any]) -> dict[str, Any]:
    if segment['x1'] < segment['x2'] or segment['y1'] < segment['y2']:
        return dict(segment)
    return {
        **segment,
        'x1': segment['x2'],
        'y1': segment['y2'],
        'x2': segment['x1'],
        'y2': segment['y1'],
    }


def segment_key(segment: dict[str, Any]) -> str:
    return f"{segment['x1']},{segment['y1']},{segment['x2']},{segment['y2']}"


def get_nearest_shell_side(room: dict[str, Any], shell: dict[str, Any]) -> dict[str, Any]:
    distances = [
        {'side': 'top', 'distance': abs(room['y'] - shell['y']), 'orientation': 'horizontal', 'x': room['x'] + room['w'] / 2, 'y': shell['y']},
        {'side': 'bottom', 'distance': abs(shell['y'] + shell['h'] - (room['y'] + room['h'])), 'orientation': 'horizontal', 'x': room['x'] + room['w'] / 2, 'y': shell['y'] + shell['h']},
        {'side': 'left', 'distance': abs(room['x'] - shell['x']), 'orientation': 'vertical', 'x': shell['x'], 'y': room['y'] + room['h'] / 2},
        {'side': 'right', 'distance': abs(shell['x'] + shell['w'] - (room['x'] + room['w'])), 'orientation': 'vertical', 'x': shell['x'] + shell['w'], 'y': room['y'] + room['h'] / 2},
    ]
    distances.sort(key=lambda item: item['distance'])
    return distances[0]


def build_geometry_model(parsed: dict[str, Any]) -> dict[str, Any]:
    load_bearing = [wall for wall in parsed['walls'] if wall['type'] == 'load-bearing']
    partition = [wall for wall in parsed['walls'] if wall['type'] == 'partition']
    scale = float(parsed['plan'].get('scale') or 0.04)

    rooms = []
    for room in parsed.get('rooms', []):
        area = round(room['w'] * room['h'] * scale * scale, 1)
        perimeter = round((2 * (room['w'] + room['h']) * scale), 1)
        span = round(max(room['w'], room['h']) * scale, 1)
        risk = 'span-risk' if span > 5 else 'large-program' if area > 18 else 'standard'
        rooms.append(
            {
                **room,
                'area': area,
                'perimeter': perimeter,
                'span': span,
                'bbox': f"({room['x']}, {room['y']}) -> ({room['x'] + room['w']}, {room['y'] + room['h']})",
                'risk': risk,
            }
        )

    junctions = collect_junctions(parsed['walls'])
    max_span = max((room['span'] for room in rooms), default=0)
    shell_area = sum(shell['w'] * shell['h'] for shell in parsed['plan'].get('outerWalls', [])) * scale * scale
    efficiency = round((parsed['plan'].get('planArea', 0) / shell_area) * 100, 1) if shell_area else 0.0
    alerts: list[str] = []

    if max_span > 5:
        alerts.append(f'Unsupported span reaches {max_span}m; consider beam or intermediate column support.')
    if len(load_bearing) < 4:
        alerts.append('Load-bearing wall count is lower than expected for a stable residential shell.')
    if len(junctions) < 12:
        alerts.append('Low junction density may reduce lateral load redistribution paths.')

    return {
        **parsed,
        'rooms': rooms,
        'loadBearing': load_bearing,
        'partition': partition,
        'junctions': junctions,
        'maxSpan': max_span,
        'metrics': {
            'shellArea': round(shell_area, 1),
            'efficiency': efficiency,
            'roomCount': len(rooms),
        },
        'alerts': alerts,
    }


def collect_junctions(walls: list[dict[str, Any]]) -> list[dict[str, Any]]:
    unique: dict[str, dict[str, Any]] = {}
    for wall in walls:
        for point in (f"{round(wall['x1'])},{round(wall['y1'])}", f"{round(wall['x2'])},{round(wall['y2'])}"):
            if point not in unique:
                x, y = point.split(',')
                unique[point] = {'id': f'J-{point}', 'x': int(x), 'y': int(y)}
    return list(unique.values())


def build_model_stats(geometry: dict[str, Any]) -> dict[str, Any]:
    scale = float(geometry['plan'].get('scale') or 0.04) * 8
    floor_height = 3
    shell_area = sum(shell['w'] * shell['h'] for shell in geometry['plan'].get('outerWalls', []))
    volume = round(shell_area * scale * scale * floor_height)
    vertex_estimate = len(geometry['walls']) * 24

    return {
        'floorHeight': floor_height,
        'volume': volume,
        'vertexEstimate': vertex_estimate,
        'footprint': 'L-Shape' if len(geometry['plan'].get('outerWalls', [])) > 1 else 'Rectilinear',
        'meshCount': len(geometry['walls']),
    }


def build_material_analysis(geometry: dict[str, Any]) -> dict[str, Any]:
    sections = [
        {'title': 'Load-Bearing Walls', 'count': len(geometry['loadBearing']), 'isLoadBearing': True, 'candidates': ['RCC', 'Precast Concrete', 'Steel Frame', 'Red Brick']},
        {'title': 'Partition Walls', 'count': len(geometry['partition']), 'isLoadBearing': False, 'candidates': ['AAC Blocks', 'Fly Ash Brick', 'Hollow Concrete Block', 'Red Brick']},
        {'title': 'Floor System', 'count': 1, 'isLoadBearing': True, 'candidates': ['RCC', 'Precast Concrete', 'Steel Frame']},
        {'title': 'Columns and Beams', 'count': max(4, math.floor(len(geometry['junctions']) / 8)), 'isLoadBearing': True, 'candidates': ['RCC', 'Steel Frame', 'Precast Concrete']},
    ]

    recommendations = []
    for section in sections:
        ranked = []
        for name in section['candidates']:
            material = MATERIALS[name]
            ranked.append(
                {
                    'name': name,
                    **material,
                    'score': score_material(material, section['isLoadBearing']),
                }
            )
        ranked.sort(key=lambda item: item['score'], reverse=True)
        recommendations.append({**section, 'ranked': ranked})

    top_selections = [{'section': section['title'], 'top': section['ranked'][0]} for section in recommendations]
    total_cost_lakh = round(
        geometry['plan'].get('planArea', 0) * 0.032 + len(geometry['loadBearing']) * 0.07 + len(geometry['partition']) * 0.025,
        2,
    )
    embodied_carbon = round(sum(item['top']['embodiedCarbon'] for item in top_selections) * 12.5, 1)
    resilience = round(
        sum(item['top']['durability'] + item['top']['strength'] for item in top_selections) / max(len(top_selections), 1),
        1,
    )

    return {
        'recommendations': recommendations,
        'topSelections': top_selections,
        'summary': {
            'totalCostLakh': total_cost_lakh,
            'embodiedCarbon': embodied_carbon,
            'resilience': resilience,
            'costEfficiency': round(10 - total_cost_lakh / 1.4, 1),
        },
    }


def score_material(material: dict[str, Any], is_load_bearing: bool) -> float:
    if is_load_bearing:
        score = (
            material['strength'] * 0.5
            + material['durability'] * 0.35
            - material['cost'] * 0.15
            - material['embodiedCarbon'] * 0.05
        )
    else:
        score = (
            material['strength'] * 0.2
            + material['durability'] * 0.25
            - material['cost'] * 0.4
            - material['embodiedCarbon'] * 0.05
        )
    return round(score, 2)


def build_explainability_report(plan: dict[str, Any], geometry: dict[str, Any], material_analysis: dict[str, Any]) -> list[dict[str, str]]:
    material_line = ', '.join(f"{item['section']}: {item['top']['name']}" for item in material_analysis['topSelections'])
    if geometry['maxSpan'] > 5:
        concerns = (
            f"The largest span is {geometry['maxSpan']}m, so beam deepening or intermediate columns "
            'should be reviewed before IFC handoff.'
        )
    else:
        concerns = (
            'No critical span exceeds 5m, which keeps the primary shell within a straightforward '
            'residential design range.'
        )

    return [
        {
            'title': 'Executive Summary',
            'body': (
                f"This {plan.get('name')} covers {plan.get('planArea')} m2 with {len(geometry['rooms'])} programmed spaces "
                f"and {len(geometry['loadBearing'])} load-bearing wall segments. The geometry is "
                f"{'non-rectilinear' if len(geometry['plan'].get('outerWalls', [])) > 1 else 'rectilinear'}, "
                f"which affects reconstruction complexity but remains manageable for a mid-rise residential workflow. "
                f"Recommended headline package: {material_line}."
            ),
        },
        {
            'title': 'Structural Assessment',
            'body': (
                f"Junction density is {len(geometry['junctions'])}, indicating "
                f"{'a strong load redistribution mesh' if len(geometry['junctions']) > 25 else 'a moderate support mesh'} "
                f"across the plan. Partition count sits at {len(geometry['partition'])}, which balances spatial flexibility "
                f"with shell clarity. {concerns}"
            ),
        },
        {
            'title': 'Material Logic',
            'body': (
                'RCC and precast options dominate load-bearing elements because strength and durability outweigh first-cost '
                'in the structural score. AAC blocks and fly ash brick stay competitive for partitions because they lower '
                'dead load and improve speed of execution without overspecifying the partition package. '
                f"The current recommendation set targets high resilience while keeping the total cost near INR "
                f"{material_analysis['summary']['totalCostLakh']} lakh for the structural package."
            ),
        },
        {
            'title': 'Delivery Notes',
            'body': (
                'This product demonstrates all five pipeline stages with realistic state flow, persistence, 2D parsing '
                'visuals, 3D generation, materials ranking, and report export. In production, the parser can be connected '
                'to CV inference and the report stage can call an LLM service using the same structured payload already '
                'generated in the pipeline.'
            ),
        },
    ]
