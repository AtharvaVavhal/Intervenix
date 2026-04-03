import logging
from datetime import datetime, timedelta, timezone
from typing import Literal

import bcrypt
from jose import JWTError, ExpiredSignatureError, jwt

from .config import get_settings

logger   = logging.getLogger(__name__)
settings = get_settings()


# ── Password ──────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── JWT ───────────────────────────────────────────────────────────────────────

TokenType = Literal["access", "refresh"]


def _create_token(user_id: int, token_type: TokenType, expires_delta: timedelta) -> str:
    now     = datetime.now(timezone.utc)
    payload = {
        "sub":  str(user_id),
        "type": token_type,
        "iat":  now,
        "exp":  now + expires_delta,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: int) -> str:
    return _create_token(
        user_id,
        "access",
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: int) -> str:
    return _create_token(
        user_id,
        "refresh",
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


class TokenError(Exception):
    """Raised when a token is invalid, expired, or the wrong type."""
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def verify_token(token: str, expected_type: TokenType) -> int:
    """
    Decode and validate a JWT.
    Returns the user_id (int) on success.
    Raises TokenError on any failure.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except ExpiredSignatureError:
        logger.warning("Token expired")
        raise TokenError("Token has expired")
    except JWTError as exc:
        logger.warning("JWT decode error: %s", exc)
        raise TokenError("Invalid token")

    if payload.get("type") != expected_type:
        raise TokenError(f"Expected {expected_type} token")

    user_id = payload.get("sub")
    if user_id is None:
        raise TokenError("Token missing subject")

    return int(user_id)
