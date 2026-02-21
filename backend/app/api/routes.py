from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..config import SESSION_TTL_SECONDS
from ..dependencies import require_session
from ..schemas import CardRegistrationPayload, LoginPayload
from ..services import auth, cards

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

# you cannot go wrong: either you are logging in or registering a new account


@router.post("/login")
async def login(payload: LoginPayload, response: Response):
    username = payload.username.strip()
    password = payload.password.strip()
    if not username or not password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="OH NAWR: username and password required")

    existing_user = auth.fetch_user(username)
    created_new = False
    if existing_user:
        stored_hash = existing_user["password_hash"]
        if auth.hash_password(password) != stored_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="OH NAWR: invalid credentials")
        user_id = int(existing_user["id"])
    else:
        user_id = auth.create_user(username, auth.hash_password(password))
        created_new = True

    session_token = auth.create_session(user_id)
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=False,
    )
    return {
        "user_id": user_id,
        "session_token": session_token,
        "is_new_user": created_new,
        "session_expires_in": SESSION_TTL_SECONDS,
    }


@router.post("/card/register")
async def register_card(payload: CardRegistrationPayload, user_id: int = Depends(require_session)):
    normalised_card_id = cards.normalise_card_id(payload.card_id)
    return cards.persist_card_assignment(user_id, normalised_card_id)


@router.post("/block")
async def block(user_id: int = Depends(require_session)):
    return cards.mark_block_pending(user_id)

# if card linked to user -> verification tap to clear pending block and update ctr
# if card not linked to user -> registration tap


@router.get("/tap")
async def tap(sun: str, ctr: int, mac: str, user_id: int = Depends(require_session)):
    cards.verify_sdm_payload(sun, ctr, mac)
    card_id = cards.derive_card_id_from_sun(sun)
    if cards.card_belongs_to_user(card_id, user_id):
        cards.ensure_pending(user_id)
        assignment = cards.persist_card_assignment(user_id, card_id, ctr, mac)
        cards.clear_pending(user_id)
        assignment["status"] = "pending_cleared"
        return assignment
    return cards.persist_card_assignment(user_id, card_id, ctr, mac)


@router.options("/tap")
def tap_options() -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)
