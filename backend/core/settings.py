from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent / '.env'


@dataclass(frozen=True)
class Settings:
    gemini_enabled: bool
    gemini_api_key: str
    gemini_model: str
    gemini_timeout_seconds: float


def get_settings() -> Settings:
    load_dotenv(ENV_PATH, override=False)
    return Settings(
        gemini_enabled=_as_bool(os.getenv('GEMINI_ENABLED', 'false')),
        gemini_api_key=os.getenv('GEMINI_API_KEY', '').strip(),
        gemini_model=os.getenv('GEMINI_MODEL', 'gemini-2.5-flash').strip() or 'gemini-2.5-flash',
        gemini_timeout_seconds=_as_float(os.getenv('GEMINI_TIMEOUT_SECONDS', '6'), default=6.0),
    )


def _as_bool(value: str) -> bool:
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


def _as_float(value: str, default: float) -> float:
    try:
        return max(float(value.strip()), 1.0)
    except (AttributeError, TypeError, ValueError):
        return default
