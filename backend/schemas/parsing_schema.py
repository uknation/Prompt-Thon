from __future__ import annotations

from pydantic import Field

from .base import StrictBaseModel


class ParsedWall(StrictBaseModel):
    id: int
    x1: float
    y1: float
    x2: float
    y2: float
    thickness: float = 0.2


class ParsedOpening(StrictBaseModel):
    id: int
    type: str
    host_orientation: str = Field(alias='hostOrientation')
    x: float
    y: float
    width: float
    height: float = 2.1


class RawContour(StrictBaseModel):
    id: int
    points: list[list[float]]
    label: str = 'contour'


class ParsingOutput(StrictBaseModel):
    walls: list[ParsedWall]
    openings: list[ParsedOpening]
    raw_contours: list[RawContour] = Field(alias='rawContours')
    confidence: float

