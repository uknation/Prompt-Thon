from __future__ import annotations

from pydantic import Field

from .base import StrictBaseModel


class GeometryNode(StrictBaseModel):
    id: int
    x: float
    y: float


class GeometryEdge(StrictBaseModel):
    id: int
    start: int
    end: int
    type: str
    source_wall_id: int
    length: float
    span: float
    connected_room_ids: list[int]


class GeometryRoom(StrictBaseModel):
    id: int
    boundary: list[list[float]]
    area: float
    centroid: list[float]


class GeometryOpening(StrictBaseModel):
    id: int
    type: str
    host_orientation: str = Field(alias='hostOrientation')
    host_wall_id: int | None = Field(default=None, alias='hostWallId')
    position: list[float]
    width: float
    height: float
    sill_height: float = Field(default=0.0, alias='sillHeight')
    room_ids: list[int] = Field(default_factory=list, alias='roomIds')


class WallReasoning(StrictBaseModel):
    wall_id: int
    wall_type: str
    is_outer_boundary: bool
    is_spine: bool
    connected_room_ids: list[int]
    support_node_ids: list[int]
    span: float
    length: float
    reason: str


class GeometryOutput(StrictBaseModel):
    nodes: list[GeometryNode]
    edges: list[GeometryEdge]
    rooms: list[GeometryRoom]
    openings: list[GeometryOpening]
    wall_types: dict[str, str]
    wall_reasoning: list[WallReasoning]
