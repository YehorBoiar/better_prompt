from fastapi import Cookie, Header

from .services.auth import get_session_user


def require_session(
    session_token_header: str | None = Header(None, alias="Authorisation"),
    session_token_cookie: str | None = Cookie(None, alias="session_token"),
) -> int:
    token = session_token_header or session_token_cookie
    return get_session_user(token)
