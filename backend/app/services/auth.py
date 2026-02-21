import hashlib
import time
import uuid
from contextlib import closing

from fastapi import HTTPException, status

from ..config import SESSION_TTL_SECONDS
from ..db import get_connection
from ..state import SESSIONS

# password hashing because we are secure


def hash_password(raw_password: str) -> str:
    return hashlib.sha256(raw_password.encode("utf-8")).hexdigest()


def fetch_user(username: str):
    with closing(get_connection()) as conn:
        return conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (username,),
        ).fetchone()


def create_user(username: str, password_hash: str) -> int:
    with closing(get_connection()) as conn:
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash),
        )
        conn.commit()
        return cursor.lastrowid


def create_session(user_id: int) -> str:
    token = uuid.uuid4().hex
    expires_at = time.time() + SESSION_TTL_SECONDS
    SESSIONS[token] = (user_id, expires_at)
    return token


def get_session_user(session_token: str | None) -> int:
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="OH NAWR: missing session token")
    session = SESSIONS.get(session_token)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="OH NAWR: invalid session")
    user_id, expires_at = session
    if time.time() > expires_at:
        del SESSIONS[session_token]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="OH NAWR: session expired")
    return user_id
