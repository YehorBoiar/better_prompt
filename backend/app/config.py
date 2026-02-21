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
