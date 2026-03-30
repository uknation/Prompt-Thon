from __future__ import annotations

from .base import StrictBaseModel


class ModelElement(StrictBaseModel):
    id: int
    type: str
    source_wall_id: int | None = None
    source_opening_id: int | None = None
    position: list[float]
    dimensions: list[float]
    rotation: list[float]
    metadata: dict[str, str | float | int | bool]


class Model3DOutput(StrictBaseModel):
    elements: list[ModelElement]
