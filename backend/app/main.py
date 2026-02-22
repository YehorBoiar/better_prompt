import hashlib
import hmac
import sqlite3
import time
import uuid
from contextlib import closing
from typing import Dict

from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Response, status
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from fastapi import FastAPI

from .api.routes import router
from .config import CORS_ALLOWED_ORIGINS, CORS_ALLOWED_ORIGIN_REGEX
from .db import init_db

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


app.include_router(router)
