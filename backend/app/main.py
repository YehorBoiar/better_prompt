import hashlib
import hmac
import sqlite3
import time
import uuid
from contextlib import closing
from typing import Dict

from fastapi import Cookie, Depends, FastAPI, Header, HTTPException, Response, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from fastapi import FastAPI

from .api.routes import router
from .db import init_db

app = FastAPI()


@app.on_event("startup")
def on_startup() -> None:
    init_db()


app.include_router(router)
