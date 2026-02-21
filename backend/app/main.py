from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from .config import APPROVAL_KEY
import time

app = FastAPI()

PENDING = False
PENDING_UNTIL = 0.0

# check if pending is not expired and exists


def _check_pending():
    global PENDING, PENDING_UNTIL
    if not PENDING:
        print("[TAP]: no pending")
        raise HTTPException(status_code=400, detail="[TAP]: no pending")
    if time.time() > PENDING_UNTIL:
        PENDING = False
        print("[TAP]: pending expired")
        raise HTTPException(
            status_code=400, detail="[TAP]: pending expired")


@app.get("/health")
def health():
    return {"status": "ok"}

# when prompt bad, prompt block for 2 min


@app.post("/block")
async def block():
    global PENDING, PENDING_UNTIL
    PENDING = True
    PENDING_UNTIL = time.time() + 120  # 2 minutes to tap the card
    print("[BLOCK]: ur prompt is blocked")
    return {"status": "blocked", "expires_in": PENDING_UNTIL}

# when card tap tap phone open link and send GET request to /tap?k=APPROVAL_KEY


@app.get("/tap", response_class=PlainTextResponse)
async def tap(k: str | None = None):
    global PENDING
    _check_pending()
    if k != APPROVAL_KEY:
        print("[TAP]: key bad")
        raise HTTPException(status_code=403, detail="[TAP]: key bad")
    PENDING = False
    print("[TAP]: ur prompt is approved")
    return "ok"
