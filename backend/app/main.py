from fastAPI import FastAPI, HTTPException, request
from fastapi.responses import PlainTextResponse
from .config import APPROVAL_KEY
import time

app = FastAPI()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/block")
async def block():
    global PENDING, PENDING_UNTIL
    PENDING = True
    PENDING_UNTIL = time.time() + 120  # 2 minutes to tap the card
    print("ur prompt has been blocked")
    return {"status": "blocked", "expires_in": PENDING_UNTIL}
