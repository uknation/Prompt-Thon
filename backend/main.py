from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router
from .core.settings import get_settings

logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(name)s: %(message)s')
get_settings()

app = FastAPI(title='Autonomous Structural Intelligence System', version='1.0.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
    allow_credentials=True,
)
app.include_router(router)
