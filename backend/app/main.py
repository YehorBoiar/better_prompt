import hashlib
import sqlite3
import time
import uuid
from contextlib import closing
from typing import Dict

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from .config import (
    APPROVAL_KEY,
    DATABASE_PATH,
    PENDING_WINDOW_SECONDS,
    SESSION_TTL_SECONDS,
)

app = FastAPI()

SESSIONS: Dict[str, tuple[int, float]] = {}
PENDING_REQUESTS: Dict[int, float] = {}

# login payload: username, password


class LoginPayload(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)


# card registration payload: card_id

class CardRegistrationPayload(BaseModel):
    card_id: str = Field(min_length=3, max_length=64)


# database get connection and initialisation

def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    with closing(_get_connection()) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                card_id TEXT NOT NULL UNIQUE,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )
        conn.commit()


# hash password when login. we are very secure


def _hash_password(raw_password: str) -> str:
    return hashlib.sha256(raw_password.encode("utf-8")).hexdigest()

# fetch user by username, return id, username and password hash


def _fetch_user(username: str):
    with closing(_get_connection()) as conn:
        return conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()

# create user with username and password hash, return user id


def _create_user(username: str, password_hash: str) -> int:
    with closing(_get_connection()) as conn:
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash),
        )
        conn.commit()
        return cursor.lastrowid

# create session for user id, return session token


def _create_session(user_id: int) -> str:
    token = uuid.uuid4().hex  # generate random session token
    expires_at = time.time() + SESSION_TTL_SECONDS
    SESSIONS[token] = (user_id, expires_at)
    return token

# get user id from session token


def _get_session_user(session_token: str | None) -> int:
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="missing session token")
    session = SESSIONS.get(session_token)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid session")
    user_id, expires_at = session
    if time.time() > expires_at:
        del SESSIONS[session_token]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="session expired")
    return user_id

# normalise card id (strip (ou la la) and uppercase)


def _normalise_card_id(card_id: str) -> str:
    normalised = card_id.strip().upper()
    if not normalised:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="card id cannot be empty")
    return normalised

# get user id by card id


def _fetch_user_id_by_card(card_id: str) -> int:
    with closing(_get_connection()) as conn:
        row = conn.execute(
            "SELECT user_id FROM cards WHERE card_id = ?", (card_id,)).fetchone()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="card not registered")
        return int(row["user_id"])

# if no pending or too long pending = bad


def _check_pending(user_id: int) -> float:
    expires_at = PENDING_REQUESTS.get(user_id)
    if not expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="no pending request for user")
    if time.time() > expires_at:
        del PENDING_REQUESTS[user_id]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="pending request expired")
    return expires_at


def _require_session(session_token: str | None = Header(None, alias="X-Session-Token")) -> int:
    return _get_session_user(session_token)


@app.on_event("startup")
def on_startup() -> None:
    _init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/login")
async def login(payload: LoginPayload):
    username = payload.username.strip()
    password = payload.password.strip()
    if not username or not password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="username and password required")

    existing_user = _fetch_user(username)
    created_new = False
    if existing_user:
        stored_hash = existing_user["password_hash"]
        if _hash_password(password) != stored_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid credentials")
        user_id = int(existing_user["id"])
    else:
        user_id = _create_user(username, _hash_password(password))
        created_new = True

    session_token = _create_session(user_id)
    return {
        "user_id": user_id,
        "session_token": session_token,
        "is_new_user": created_new,
        "session_expires_in": SESSION_TTL_SECONDS,
    }


@app.post("/card/register")
async def register_card(payload: CardRegistrationPayload, user_id: int = Depends(_require_session)):
    normalised_card_id = _normalise_card_id(payload.card_id)
    with closing(_get_connection()) as conn:
        existing = conn.execute(
            "SELECT user_id FROM cards WHERE card_id = ?", (normalised_card_id,)).fetchone()
        if existing and int(existing["user_id"]) != user_id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                detail="card already assigned to a different user")

        conn.execute(
            """
            INSERT INTO cards (user_id, card_id)
            VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET card_id = excluded.card_id
            """,
            (user_id, normalised_card_id),
        )
        conn.commit()

    return {"status": "card_registered", "card_id": normalised_card_id, "user_id": user_id}


@app.post("/block")
async def block(user_id: int = Depends(_require_session)):
    expires_at = time.time() + PENDING_WINDOW_SECONDS
    PENDING_REQUESTS[user_id] = expires_at
    return {"status": "blocked", "user_id": user_id, "expires_at": expires_at, "ttl": PENDING_WINDOW_SECONDS}


@app.get("/tap", response_class=PlainTextResponse)
async def tap(card_id: str, k: str | None = None):
    if APPROVAL_KEY and k != APPROVAL_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="invalid approval key")

    normalised_card_id = _normalise_card_id(card_id)
    user_id = _fetch_user_id_by_card(normalised_card_id)
    _check_pending(user_id)
    del PENDING_REQUESTS[user_id]
    return "ok"
