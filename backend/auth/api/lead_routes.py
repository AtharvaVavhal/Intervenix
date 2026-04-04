import logging
import time
import threading
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.lead import Lead
from ..models.user import User
from ..services.lead_service import score_lead, send_lead_notification
from .auth_routes import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lead", tags=["lead"])


# ── Rate limiter (in-memory, single-worker) ───────────────────────────────────
# For multi-worker deployments, swap this store for Redis.

_rate_store: dict[str, deque] = defaultdict(deque)
_rate_lock  = threading.Lock()
_WINDOW_SEC = 60
_MAX_HITS   = 5


def _client_ip(request: Request) -> str:
    """Prefer X-Forwarded-For (Railway / Vercel proxy) over direct socket."""
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _enforce_rate_limit(request: Request) -> None:
    ip  = _client_ip(request)
    now = time.monotonic()
    cutoff = now - _WINDOW_SEC

    with _rate_lock:
        dq = _rate_store[ip]
        while dq and dq[0] < cutoff:
            dq.popleft()
        if len(dq) >= _MAX_HITS:
            logger.warning("Rate limit hit from ip=%s", ip)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests — max 5 per minute per IP.",
                headers={"Retry-After": "60"},
            )
        dq.append(now)


# ── Admin guard ───────────────────────────────────────────────────────────────

def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


# ── Request schema ────────────────────────────────────────────────────────────

class LeadRequest(BaseModel):
    name:               str
    email:              EmailStr
    company:            str
    role:               str
    volume:             int      # monthly transaction volume — stored as integer
    use_case:           str
    problem:            str
    stack:              str
    notes:              str  = ""
    callback_requested: bool = False

    @field_validator("name", "company", "role", "use_case", "problem", "stack")
    @classmethod
    def not_empty(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Field cannot be empty.")
        if len(stripped) < 2:
            raise ValueError("Field must be at least 2 characters.")
        return stripped

    @field_validator("name", "company")
    @classmethod
    def min_length(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Must be at least 2 characters.")
        return v.strip()

    @field_validator("volume")
    @classmethod
    def positive_volume(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Volume must be a positive integer.")
        if v > 1_000_000_000:
            raise ValueError("Volume value is implausibly large.")
        return v

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        allowed = {"risk", "data", "engineering", "other"}
        if v.strip().lower() not in allowed:
            raise ValueError(f"role must be one of: {', '.join(sorted(allowed))}")
        return v.strip().lower()

    @field_validator("use_case")
    @classmethod
    def valid_use_case(cls, v: str) -> str:
        allowed = {"fraud", "credit", "collections", "other"}
        if v.strip().lower() not in allowed:
            raise ValueError(f"use_case must be one of: {', '.join(sorted(allowed))}")
        return v.strip().lower()

    @field_validator("problem", "stack")
    @classmethod
    def min_length_long(cls, v: str) -> str:
        if len(v.strip()) < 10:
            raise ValueError("Please provide at least 10 characters.")
        return v.strip()


# ── Response schemas ──────────────────────────────────────────────────────────

class LeadResponse(BaseModel):
    status: str
    id:     int


class LeadRecord(BaseModel):
    id:                 int
    name:               str
    email:              str
    company:            str
    role:               str
    volume:             int
    use_case:           str
    problem:            str
    stack:              str
    notes:              str
    callback_requested: bool
    lead_score:         int
    priority:           str
    created_at:         str

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_record(lead: Lead) -> LeadRecord:
    return LeadRecord(
        id                 = lead.id,
        name               = lead.name,
        email              = lead.email,
        company            = lead.company,
        role               = lead.role,
        volume             = lead.volume,
        use_case           = lead.use_case,
        problem            = lead.problem,
        stack              = lead.stack,
        notes              = lead.notes,
        callback_requested = lead.callback_requested,
        lead_score         = lead.lead_score,
        priority           = lead.priority,
        created_at         = lead.created_at.isoformat(),
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post(
    "/talk-to-engineer",
    response_model=LeadResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_lead(
    request: Request,
    body: LeadRequest,
    db: Session = Depends(get_db),
) -> LeadResponse:
    _enforce_rate_limit(request)

    lead = Lead(
        name               = body.name,
        email              = str(body.email),
        company            = body.company,
        role               = body.role,
        volume             = body.volume,
        use_case           = body.use_case,
        problem            = body.problem,
        stack              = body.stack,
        notes              = body.notes,
        callback_requested = body.callback_requested,
    )

    score_lead(lead)

    db.add(lead)
    db.commit()
    db.refresh(lead)

    logger.info(
        "lead.created id=%d email=%s company=%r volume=%d score=%d priority=%s callback=%s ip=%s",
        lead.id, lead.email, lead.company, lead.volume,
        lead.lead_score, lead.priority, lead.callback_requested,
        _client_ip(request),
    )

    send_lead_notification(lead)

    return LeadResponse(status="ok", id=lead.id)


@router.get(
    "/all",
    response_model=list[LeadRecord],
)
def get_all_leads(
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
) -> list[LeadRecord]:
    leads = db.query(Lead).order_by(Lead.lead_score.desc()).all()
    logger.info("lead.all fetched count=%d", len(leads))
    return [_to_record(l) for l in leads]


@router.get(
    "/high-priority",
    response_model=list[LeadRecord],
)
def get_high_priority_leads(
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
) -> list[LeadRecord]:
    leads = (
        db.query(Lead)
        .filter(Lead.priority == "high")
        .order_by(Lead.lead_score.desc())
        .all()
    )
    logger.info("lead.high_priority fetched count=%d", len(leads))
    return [_to_record(l) for l in leads]
