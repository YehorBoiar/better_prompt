from fastapi import Cookie, Header, HTTPException, status
from .services.auth import get_session_user

def require_session(
    authorization: str | None = Header(None),
    session_token: str | None = Cookie(None),
) -> int:
    token = session_token

    if not token and authorization:
        if authorization.startswith("Bearer "):
            token = authorization.split(" ")[1]
        else:
            token = authorization

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing session token"
        )

    return get_session_user(token)