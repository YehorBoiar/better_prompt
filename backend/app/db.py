import sqlite3
from contextlib import closing

from .config import DATABASE_PATH


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with closing(get_connection()) as conn:
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
                last_ctr INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )
        _ensure_cards_schema(conn)
        conn.commit()


def _ensure_cards_schema(conn: sqlite3.Connection) -> None:
    columns = {row["name"] for row in conn.execute(
        "PRAGMA table_info(cards)").fetchall()}
    if "last_ctr" not in columns:
        conn.execute(
            "ALTER TABLE cards ADD COLUMN last_ctr INTEGER NOT NULL DEFAULT 0")
