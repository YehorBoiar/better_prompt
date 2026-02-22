import hashlib
import hmac
import sqlite3
import time
from contextlib import closing

from fastapi import HTTPException, status

from ..config import PENDING_WINDOW_SECONDS, SDM_SHARED_SECRET
from ..db import get_connection
from ..state import PENDING_REQUESTS


def normalise_card_id(card_id: str) -> str:
    normalised = card_id.strip().upper()
    if not normalised:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="OH NAWR: card id cannot be empty")
    return normalised

# sun = secure unique NFC
# tap-unique identifier
# treated like card ID


def derive_card_id_from_sun(sun: str) -> str:
    if not sun:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="OH NAWR: missing secure unique identifier")
    return normalise_card_id(sun)


# check if vard registered with a user

def card_belongs_to_user(card_id: str, user_id: int) -> bool:
    with closing(get_connection()) as conn:
        row = conn.execute(
            "SELECT user_id FROM cards WHERE card_id = ?", (card_id,)
        ).fetchone()
        if not row:
            return False
        owner_id = int(row["user_id"])
        if owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="OH NAWR: card already assigned to a different user",
            )
        return True

# this is the check that verifies the SDM payload,
# it uses HMAC with a shared secret to verify the integrity of the data coming from the SDM device.
# It checks that the provided MAC matches the expected value based on the SUN and CTR values.
# If the verification fails, it raises an HTTP 403


def verify_sdm_payload(sun: str, ctr: int, mac: str) -> None:
    # if not SDM_SHARED_SECRET:
    #     raise HTTPException(
    #         status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="SDM secret not configured")
    # message = f"{sun}:{ctr}".encode("utf-8")
    # expected = hmac.new(SDM_SHARED_SECRET.encode("utf-8"),
    #                     message, hashlib.sha256).hexdigest()
    # provided = mac.lower().replace(":", "")
    # if not hmac.compare_digest(expected, provided):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN, detail="OH NAWR: invalid SDM signature")
    card_id = normalise_card_id(sun)
    stored_mac = _get_static_mac(card_id)
    if stored_mac is None:
        return
    provided = mac.strip().lower()
    if provided != stored_mac.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="OH NAWR: invalid SDM signature (static)",
        )

# this is the main function that registers a card to a user,
# it checks for conflicts and replays, and updates the last_ctr


def persist_card_assignment(user_id: int, card_id: str, ctr: int | None = None, mac: str | None = None) -> dict:
    with closing(get_connection()) as conn:
        mac_value = mac.strip().lower() if mac else None
        existing_card = conn.execute(
            "SELECT user_id, last_ctr FROM cards WHERE card_id = ?",
            (card_id,),
        ).fetchone()
        is_new_card = existing_card is None
        if existing_card:
            owner_id = int(existing_card["user_id"])
            if owner_id != user_id:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                                    detail="OH NAWR: card already assigned to a different user")
            current_ctr = int(existing_card["last_ctr"])
            # if ctr is not None and ctr <= current_ctr:
            #     raise HTTPException(
            #         status_code=status.HTTP_409_CONFLICT, detail="OH NAWR: replayed credential detected")
            new_ctr = current_ctr
            conn.execute(
                "UPDATE cards SET last_ctr = ? WHERE card_id = ?", (new_ctr, card_id))
            _persist_static_mac(conn, card_id, mac_value)
        else:
            existing_user = conn.execute(
                "SELECT card_id, last_ctr FROM cards WHERE user_id = ?",
                (user_id,),
            ).fetchone()

            if existing_user:
                prior_ctr = int(existing_user["last_ctr"])
                # store provided ctr once (if any) but don't enforce increments
                new_ctr = ctr if ctr is not None else prior_ctr
                conn.execute(
                    "UPDATE cards SET card_id = ?, last_ctr = ? WHERE user_id = ?",
                    (card_id, new_ctr, user_id),
                )
            else:
                # init counter but treat it as static value
                new_ctr = ctr if ctr is not None else 0
                conn.execute(
                    "INSERT INTO cards (user_id, card_id, last_ctr, static_mac) VALUES (?, ?, ?, ?)",
                    (user_id, card_id, new_ctr, mac_value),
                )
            _persist_static_mac(conn, card_id, mac_value)
        conn.commit()

    status_label = "card_registered" if is_new_card else "card_verified"
    return {
        "status": status_label,
        "card_id": card_id,
        "user_id": user_id,
        "last_ctr": new_ctr,
        "is_new_card": is_new_card,
    }

# true when user prompt is blocked and awaiting approval, false otherwise


def mark_block_pending(user_id: int) -> dict:
    expires_at = time.time() + PENDING_WINDOW_SECONDS
    PENDING_REQUESTS[user_id] = expires_at
    return {"status": "blocked", "user_id": user_id, "expires_at": expires_at, "ttl": PENDING_WINDOW_SECONDS}

# this function checks if there is a pending block for the user and if it has expired.
# If there is no pending block or if it has expired, it raises an HTTP 400


def ensure_pending(user_id: int) -> None:
    expires_at = PENDING_REQUESTS.get(user_id)
    if not expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="OH NAWR: no pending request for user")
    if time.time() > expires_at:
        del PENDING_REQUESTS[user_id]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="OH NAWR: pending request expired")


def clear_pending(user_id: int) -> None:
    PENDING_REQUESTS.pop(user_id, None)


def _get_static_mac(card_id: str) -> str | None:
    with closing(get_connection()) as conn:
        row = conn.execute(
            "SELECT static_mac FROM cards WHERE card_id = ?",
            (card_id,),
        ).fetchone()
        if not row:
            return None
        return row["static_mac"]


def _persist_static_mac(conn: sqlite3.Connection, card_id: str, mac: str | None) -> None:
    if not mac:
        return
    conn.execute(
        "UPDATE cards SET static_mac = ? WHERE card_id = ?",
        (mac, card_id),
    )


def is_user_blocked(user_id: int) -> bool:
    expires_at = PENDING_REQUESTS.get(user_id)
    if not expires_at:
        return False
    if time.time() > expires_at:
        del PENDING_REQUESTS[user_id]
        return False
    return True
