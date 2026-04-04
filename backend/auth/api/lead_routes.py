import logging
import time
import threading
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.lead import Lead, LEAD_STATUSES, VALID_TRANSITIONS
from ..models.user import User
from ..services.lead_service import score_lead, send_lead_notification
from .auth_routes import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lead", tags=["lead"])


# ── Rate limiter (in-memory, single-worker) ───────────────────────────────────

_rate_store: dict[str, deque] = defaultdict(deque)
_rate_lock  = threading.Lock()
_WINDOW_SEC = 60
_MAX_HITS   = 5


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _enforce_rate_limit(request: Request) -> None:
    ip     = _client_ip(request)
    now    = time.monotonic()
    cutoff = now - _WINDOW_SEC
    with _rate_lock:
        dq = _rate_store[ip]
        while dq and dq[0] < cutoff:
            dq.popleft()
        if len(dq) >= _MAX_HITS:
            logger.warning("rate_limit ip=%s", ip)
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


# ── Request schemas ───────────────────────────────────────────────────────────

class LeadRequest(BaseModel):
    name:               str
    email:              EmailStr
    company:            str
    role:               str
    volume:             int
    use_case:           str
    problem:            str
    stack:              str
    notes:              str  = ""
    callback_requested: bool = False

    @field_validator("name", "company", "role", "use_case", "problem", "stack")
    @classmethod
    def not_empty(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field cannot be empty.")
        return s

    @field_validator("name", "company")
    @classmethod
    def min_two_chars(cls, v: str) -> str:
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
        val = v.strip().lower()
        if val not in allowed:
            raise ValueError(f"role must be one of: {', '.join(sorted(allowed))}")
        return val

    @field_validator("use_case")
    @classmethod
    def valid_use_case(cls, v: str) -> str:
        allowed = {"fraud", "credit", "collections", "other"}
        val = v.strip().lower()
        if val not in allowed:
            raise ValueError(f"use_case must be one of: {', '.join(sorted(allowed))}")
        return val

    @field_validator("problem", "stack")
    @classmethod
    def min_length_long(cls, v: str) -> str:
        s = v.strip()
        if len(s) < 10:
            raise ValueError("Please provide at least 10 characters.")
        return s


class LeadUpdateRequest(BaseModel):
    status:         str | None = None
    assigned_to_id: int | None = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if v not in LEAD_STATUSES:
            raise ValueError(f"status must be one of: {', '.join(LEAD_STATUSES)}")
        return v


# ── Response schemas ──────────────────────────────────────────────────────────

class LeadResponse(BaseModel):
    status: str   # "ok" | "exists"
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
    status:             str
    assigned_to_id:     int | None
    created_at:         str

    model_config = {"from_attributes": True}


class LeadAnalytics(BaseModel):
    total_leads:         int
    high_priority_count: int
    conversion_rate:     float
    status_breakdown:    dict[str, int]


# ── Helper ────────────────────────────────────────────────────────────────────

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
        status             = lead.status,
        assigned_to_id     = lead.assigned_to_id,
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

    # ── Deduplication: reject same email within last 24 hours ─────────────────
    cutoff   = datetime.now(timezone.utc) - timedelta(hours=24)
    existing = (
        db.query(Lead)
        .filter(Lead.email == str(body.email).lower(), Lead.created_at >= cutoff)
        .first()
    )
    if existing:
        logger.info(
            "lead.duplicate email=%s existing_id=%d ip=%s",
            body.email, existing.id, _client_ip(request),
        )
        return LeadResponse(status="exists", id=existing.id)

    # ── Create ────────────────────────────────────────────────────────────────
    lead = Lead(
        name               = body.name,
        email              = str(body.email).lower(),
        company            = body.company,
        role               = body.role,
        volume             = body.volume,
        use_case           = body.use_case,
        problem            = body.problem,
        stack              = body.stack,
        notes              = body.notes,
        callback_requested = body.callback_requested,
        status             = "new",
    )
    score_lead(lead)

    db.add(lead)
    db.commit()
    db.refresh(lead)

    logger.info(
        "lead.created id=%d email=%s company=%r volume=%d score=%d priority=%s ip=%s",
        lead.id, lead.email, lead.company, lead.volume,
        lead.lead_score, lead.priority, _client_ip(request),
    )

    send_lead_notification(lead)
    return LeadResponse(status="ok", id=lead.id)


@router.patch(
    "/{lead_id}",
    response_model=LeadRecord,
)
def update_lead(
    lead_id: int,
    body: LeadUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin),
) -> LeadRecord:
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found.")

    # ── Status transition validation ──────────────────────────────────────────
    if body.status is not None and body.status != lead.status:
        allowed = VALID_TRANSITIONS.get(lead.status, frozenset())
        if body.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Cannot transition '{lead.status}' → '{body.status}'. "
                    f"Allowed next states: {sorted(allowed) or 'none (terminal state)'}."
                ),
            )
        lead.status = body.status
        logger.info(
            "lead.status_changed id=%d %s → %s by admin=%s",
            lead.id, lead.status, body.status, admin.email,
        )

    # ── Assignment ────────────────────────────────────────────────────────────
    if body.assigned_to_id is not None:
        if body.assigned_to_id == 0:
            lead.assigned_to_id = None   # 0 means unassign
        else:
            assignee = db.get(User, body.assigned_to_id)
            if not assignee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User id={body.assigned_to_id} not found.",
                )
            lead.assigned_to_id = body.assigned_to_id
            logger.info(
                "lead.assigned id=%d → user=%s by admin=%s",
                lead.id, assignee.email, admin.email,
            )

    db.commit()
    db.refresh(lead)
    return _to_record(lead)


@router.get(
    "/analytics",
    response_model=LeadAnalytics,
)
def get_analytics(
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
) -> LeadAnalytics:
    # Single aggregation query — no N+1
    rows = (
        db.query(Lead.status, func.count(Lead.id))
        .group_by(Lead.status)
        .all()
    )

    breakdown: dict[str, int] = {s: 0 for s in LEAD_STATUSES}
    for lead_status, count in rows:
        if lead_status in breakdown:
            breakdown[lead_status] = count

    total     = sum(breakdown.values())
    converted = breakdown.get("converted", 0)
    conversion_rate = round(converted / total * 100, 1) if total > 0 else 0.0

    high_count = (
        db.query(func.count(Lead.id))
        .filter(Lead.priority == "high")
        .scalar()
    ) or 0

    return LeadAnalytics(
        total_leads         = total,
        high_priority_count = high_count,
        conversion_rate     = conversion_rate,
        status_breakdown    = breakdown,
    )


@router.get(
    "/all",
    response_model=list[LeadRecord],
)
def get_all_leads(
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
) -> list[LeadRecord]:
    leads = db.query(Lead).order_by(Lead.lead_score.desc()).all()
    logger.info("lead.all count=%d", len(leads))
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
    return [_to_record(l) for l in leads]
