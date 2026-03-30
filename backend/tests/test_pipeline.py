from __future__ import annotations

import os
import unittest

import cv2
import numpy as np

from backend.core.pipeline import AutonomousStructuralPipeline
from backend.data.sample_inputs import SAMPLE_PLANS
from backend.schemas.input_schema import StructuralPlanInput
from backend.services.parsing import ParsingService


class AutonomousStructuralPipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        os.environ['GEMINI_ENABLED'] = 'false'
        self.pipeline = AutonomousStructuralPipeline()

    def test_sample_plan_runs_end_to_end(self) -> None:
        result = self.pipeline.run_plan(StructuralPlanInput(**SAMPLE_PLANS['B']))

        self.assertTrue(result.success)
        self.assertGreater(len(result.stage_outputs.parsing.walls), 4)
        self.assertGreater(len(result.stage_outputs.parsing.openings), 0)
        self.assertGreater(len(result.stage_outputs.geometry.nodes), 4)
        self.assertGreater(len(result.stage_outputs.geometry.rooms), 0)
        self.assertGreater(len(result.stage_outputs.geometry.openings), 0)
        self.assertGreater(len(result.stage_outputs.model3d.elements), 0)
        self.assertGreater(len(result.stage_outputs.materials.results), 0)
        self.assertGreater(len(result.stage_outputs.explainability.results), 0)
        model_types = {element.type for element in result.stage_outputs.model3d.elements}
        self.assertIn('door', model_types)
        self.assertIn('window', model_types)

    def test_reasoning_distinguishes_load_bearing_and_partition_logic(self) -> None:
        result = self.pipeline.run_plan(StructuralPlanInput(**SAMPLE_PLANS['B']))
        wall_reasoning = result.stage_outputs.geometry.wall_reasoning

        load_bearing = [item for item in wall_reasoning if item.wall_type == 'load_bearing']
        partitions = [item for item in wall_reasoning if item.wall_type == 'partition']

        self.assertGreater(len(load_bearing), 0)
        self.assertGreater(len(partitions), 0)

        partition_recommendations = [
            item.recommendations[0].material
            for item in result.stage_outputs.materials.results
            if item.wall_type == 'partition'
        ]
        self.assertTrue(partition_recommendations)
        self.assertTrue(all(material == 'AAC Blocks' for material in partition_recommendations))

        explanation = result.stage_outputs.explainability.results[0].explanation.lower()
        self.assertIn('spans', explanation)
        self.assertTrue('load-bearing' in explanation or 'partition' in explanation)

    def test_text_mask_suppresses_room_labels(self) -> None:
        parser = ParsingService()
        image = np.full((320, 320, 3), 255, dtype=np.uint8)
        cv2.rectangle(image, (35, 35), (285, 285), (0, 0, 0), thickness=8)
        cv2.line(image, (160, 35), (160, 285), (0, 0, 0), thickness=6)
        cv2.putText(image, 'BED', (90, 170), cv2.FONT_HERSHEY_SIMPLEX, 1.4, (0, 0, 0), 3, cv2.LINE_AA)

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        wall_mask = parser._build_wall_mask(gray)
        text_mask = parser._build_text_mask(image, gray, wall_mask)

        center_region = text_mask[110:200, 70:240]
        top_wall_region = text_mask[28:48, 40:280]

        self.assertGreater(np.count_nonzero(center_region), 500)
        self.assertLess(np.count_nonzero(top_wall_region), 200)

    def test_parser_refines_lines_and_snaps_openings(self) -> None:
        parser = ParsingService()
        refined = parser._refine_detected_lines(
            [
                {'x1': 0.18, 'y1': 0.18, 'x2': 0.42, 'y2': 0.18},
                {'x1': 0.41, 'y1': 0.181, 'x2': 0.66, 'y2': 0.181},
                {'x1': 0.12, 'y1': 0.08, 'x2': 0.88, 'y2': 0.08},
            ],
            {'x': 0.08, 'y': 0.08, 'w': 0.84, 'h': 0.84},
        )
        self.assertEqual(len(refined), 1)
        self.assertAlmostEqual(refined[0]['x1'], 0.18, places=2)
        self.assertAlmostEqual(refined[0]['x2'], 0.66, places=2)

        parsed = parser.parse_plan(
            StructuralPlanInput(
                **{
                    'name': 'temp',
                    'scale': 1.0,
                    'outerWalls': [],
                    'wallSegments': [{'x1': 0, 'y1': 0, 'x2': 6, 'y2': 0, 'thickness': 0.3}],
                }
            )
        )
        aligned = parser._align_openings_to_walls(
            [
                {'type': 'window', 'hostOrientation': 'horizontal', 'x': 2.4, 'y': 0.22, 'width': 1.2, 'height': 1.2},
            ],
            parsed.walls,
        )
        self.assertEqual(len(aligned), 1)
        self.assertAlmostEqual(float(aligned[0]['y']), 0.0, places=3)


if __name__ == '__main__':
    unittest.main()
