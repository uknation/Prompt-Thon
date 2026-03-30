from __future__ import annotations

from pydantic import Field

from .base import StrictBaseModel


class ShellRect(StrictBaseModel):
    x: float
    y: float
    w: float
    h: float


class InputRoom(StrictBaseModel):
    name: str
    x: float
    y: float
    w: float
    h: float
    color: str | None = None


class InputWallSegment(StrictBaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    type: str = 'partition'
    thickness: float | None = None


class InputOpening(StrictBaseModel):
    id: str | None = None
    type: str
    host_orientation: str = Field(alias='hostOrientation')
    x: float
    y: float
    width: float
    height: float = 2.1


class StructuralPlanInput(StrictBaseModel):
    id: str | None = None
    name: str
    description: str | None = None
    scale: float = 0.04
    plan_area: float = Field(default=0.0, alias='planArea')
    purpose: str | None = None
    outer_walls: list[ShellRect] = Field(default_factory=list, alias='outerWalls')
    rooms: list[InputRoom] = Field(default_factory=list)
    wall_segments: list[InputWallSegment] = Field(default_factory=list, alias='wallSegments')
    openings: list[InputOpening] = Field(default_factory=list)


class PlanPipelineRequest(StrictBaseModel):
    plan: StructuralPlanInput

