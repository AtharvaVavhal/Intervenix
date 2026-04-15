import logging
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from ..models.user import User
from ..core.config import get_settings
from ..core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    TokenError,
)
from ..schemas.auth import TokenResponse, AccessTokenResponse

logger = logging.getLogger(__name__)


# ── User queries ──────────────────────────────────────────────────────────────

def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


# ── Auth flows ────────────────────────────────────────────────────────────────

def signup(db: Session, email: str, password: str) -> TokenResponse:
    if get_user_by_email(db, email):
        logger.warning("Signup attempt for existing email: %s", email)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    settings  = get_settings()
    is_admin  = bool(settings.ADMIN_EMAIL and email.lower() == settings.ADMIN_EMAIL.lower())

    user = User(email=email, hashed_password=hash_password(password), is_admin=is_admin)
    db.add(user)
    db.commit()
    db.refresh(user)

    logger.info("New user registered: id=%d email=%s is_admin=%s", user.id, user.email, user.is_admin)
    return _issue_tokens(user.id)


def login(db: Session, email: str, password: str) -> TokenResponse:
    user = get_user_by_email(db, email)

    # Constant-time path: always verify even if user doesn't exist to prevent timing attacks
    dummy_hash = "$2b$12$invalidhashvaluethatisusedtopreventtimingattacks000000000"
    hashed     = user.hashed_password if user else dummy_hash

    if not verify_password(password, hashed) or user is None:
        logger.warning("Failed login attempt for email: %s", email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    logger.info("User logged in: id=%d email=%s", user.id, user.email)
    return _issue_tokens(user.id)


def refresh(db: Session, refresh_token: str) -> AccessTokenResponse:
    try:
        user_id = verify_token(refresh_token, expected_type="refresh")
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=exc.detail,
        )

    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    logger.info("Token refreshed for user id=%d", user.id)
    return AccessTokenResponse(access_token=create_access_token(user.id))


# ── Internal ──────────────────────────────────────────────────────────────────

def _issue_tokens(user_id: int) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )
