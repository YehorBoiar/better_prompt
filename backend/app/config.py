import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

_BASE_DIR = Path(__file__).resolve().parent

APPROVAL_KEY = os.getenv("APPROVAL_KEY")

DATABASE_PATH = os.getenv("DATABASE_PATH") or str(_BASE_DIR / "app.sqlite3")
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", "28800"))
PENDING_WINDOW_SECONDS = int(os.getenv("PENDING_WINDOW_SECONDS", "120"))
SDM_SHARED_SECRET = os.getenv("SDM_SHARED_SECRET")


def _parse_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _normalize_regex(value: str | None) -> str | None:
    if not value:
        return None

    trimmed = value.strip()
    if trimmed.startswith("[") and trimmed.endswith("]"):
        trimmed = trimmed[1:-1]

    parts = [part.strip().strip('"\'') for part in trimmed.split(",") if part.strip()]
    if not parts:
        return None
    if len(parts) == 1:
        return parts[0]
    return "(" + ")|(".join(parts) + ")"


_cors_origins_env = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
CORS_ALLOWED_ORIGINS = _parse_csv(_cors_origins_env)
CORS_ALLOWED_ORIGIN_REGEX = _normalize_regex(
    os.getenv("ALLOWED_ORIGIN_REGEX", r"https://.*\\.ngrok-free\\.(app|dev)")
)
