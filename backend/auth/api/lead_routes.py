import logging
import time
import threading
from collections import defaultdict, deque
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.lead import Lead, LEAD_STATUSES, VALID_TRANSITIONS
from ..models.lead_event import LeadEvent
from ..models.user import User
from ..services.lead_service import score_lead, send_lead_notification
from ..services.lead_event_service import log_event
from .auth_routes import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lead", tags=["lead"])

_STALE_DAYS    = 3
_TERMINAL      = {"converted", "rejected"}

# ── Rate limiter ──────────────────────────────────────────────────────────────

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
    ip, now, cutoff = _client_ip(request), time.monotonic(), time.monotonic() - _WINDOW_SEC
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


# ── Guards ────────────────────────────────────────────────────────────────────

def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return current_user


# ── Auto-assign ───────────────────────────────────────────────────────────────

def _auto_assign_user_id(db: Session) -> int | None:
    """
    Return the non-admin user with the fewest active (non-terminal) lead
    assignments.  Returns None if no non-admin users exist.
    """
    result = (
        db.query(User.id)
        .outerjoin(
            Lead,
            (Lead.assigned_to_id == User.id) &
            Lead.status.notin_(list(_TERMINAL)),
        )
        .filter(User.is_admin == False)   # noqa: E712
        .group_by(User.id)
        .order_by(func.count(Lead.id).asc())
        .first()
    )
    return result[0] if result else None


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
        if v is not None and v not in LEAD_STATUSES:
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
    last_contacted_at:  str | None
    created_at:         str

    model_config = {"from_attributes": True}


class PaginatedLeads(BaseModel):
    total:  int
    limit:  int
    offset: int
    items:  list[LeadRecord]


class LeadEventRecord(BaseModel):
    id:              int
    lead_id:         int
    action:          str
    old_value:       str | None
    new_value:       str | None
    performed_by_id: int | None
    created_at:      str

    model_config = {"from_attributes": True}


class AssigneeStats(BaseModel):
    user_id:         int
    email:           str
    assigned_count:  int
    converted_count: int
    conversion_rate: float


class LeadAnalytics(BaseModel):
    total_leads:         int
    high_priority_count: int
    conversion_rate:     float
    status_breakdown:    dict[str, int]
    assignee_stats:      list[AssigneeStats] = []


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
        last_contacted_at  = lead.last_contacted_at.isoformat() if lead.last_contacted_at else None,
        created_at         = lead.created_at.isoformat(),
    )


def _to_event_record(ev: LeadEvent) -> LeadEventRecord:
    return LeadEventRecord(
        id              = ev.id,
        lead_id         = ev.lead_id,
        action          = ev.action,
        old_value       = ev.old_value,
        new_value       = ev.new_value,
        performed_by_id = ev.performed_by_id,
        created_at      = ev.created_at.isoformat(),
    )


# ── Routes — public ───────────────────────────────────────────────────────────

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

    # Dedup: same email within 24 h
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    existing = (
        db.query(Lead)
        .filter(Lead.email == str(body.email).lower(), Lead.created_at >= cutoff)
        .first()
    )
    if existing:
        logger.info("lead.duplicate email=%s existing_id=%d ip=%s", body.email, existing.id, _client_ip(request))
        return LeadResponse(status="exists", id=existing.id)

    # Auto-assign to least-loaded non-admin user
    assignee_id = _auto_assign_user_id(db)

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
        assigned_to_id     = assignee_id,
    )
    score_lead(lead)
    db.add(lead)
    db.flush()  # get lead.id before logging events

    # Audit: created
    log_event(db, lead.id, "created", new_value=lead.email)

    # Audit: auto-assigned
    if assignee_id:
        log_event(db, lead.id, "assigned", new_value=str(assignee_id))

    db.commit()
    db.refresh(lead)

    logger.info(
        "lead.created id=%d email=%s score=%d priority=%s assignee=%s ip=%s",
        lead.id, lead.email, lead.lead_score, lead.priority, assignee_id, _client_ip(request),
    )
    send_lead_notification(lead)
    return LeadResponse(status="ok", id=lead.id)


# ── Routes — admin: static paths first, parameterised last ───────────────────

@router.get("/analytics", response_model=LeadAnalytics)
def get_analytics(
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
) -> LeadAnalytics:
    # Status breakdown
    rows = db.query(Lead.status, func.count(Lead.id)).group_by(Lead.status).all()
    breakdown: dict[str, int] = {s: 0 for s in LEAD_STATUSES}
    for s, cnt in rows:
        if s in breakdown:
            breakdown[s] = cnt

    total    = sum(breakdown.values())
    converted = breakdown.get("converted", 0)

    high_count = db.query(func.count(Lead.id)).filter(Lead.priority == "high").scalar() or 0

    # Assignee performance — one query, no N+1
    agg = (
        db.query(
            User.id,
            User.email,
            func.count(Lead.id).label("assigned_count"),
            func.sum(case((Lead.status == "converted", 1), else_=0)).label("converted_count"),
        )
        .outerjoin(Lead, Lead.assigned_to_id == User.id)
        .filter(User.is_admin == False)   # noqa: E712
        .group_by(User.id, User.email)
        .all()
    )
    assignee_stats = [
        AssigneeStats(
            user_id         = row.id,
            email           = row.email,
            assigned_count  = row.assigned_count or 0,
            converted_count = row.converted_count or 0,
            conversion_rate = round(
                (row.converted_count or 0) / row.assigned_count * 100, 1
            ) if row.assigned_count else 0.0,
        )
        for row in agg
    ]

    return LeadAnalytics(
        total_leads         = total,
        high_priority_count = high_count,
        conversion_rate     = round(converted / total * 100, 1) if total else 0.0,
        status_breakdown    = breakdown,
        assignee_stats      = assignee_stats,
    )


@router.get("/all", response_model=PaginatedLeads)
def get_all_leads(
    limit:  int = Query(20, ge=1, le=100),
    offset: int = Query(0,  ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
) -> PaginatedLeads:
    total = db.query(func.count(Lead.id)).scalar() or 0
    leads = (
        db.query(Lead)
        .order_by(Lead.lead_score.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return PaginatedLeads(total=total, limit=limit, offset=offset, items=[_to_record(l) for l in leads])


@router.get("/high-priority", response_model=list[LeadRecord])
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


@router.get("/stale", response_model=list[LeadRecord])
def get_stale_leads(
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
) -> list[LeadRecord]:
    """
    Leads in 'contacted' status that haven't been touched in ≥3 days.
    Sorted by score DESC so the most valuable stale leads surface first.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=_STALE_DAYS)
    leads = (
        db.query(Lead)
        .filter(
            Lead.status == "contacted",
            (Lead.last_contacted_at == None) | (Lead.last_contacted_at < cutoff),  # noqa: E711
        )
        .order_by(Lead.lead_score.desc())
        .all()
    )
    return [_to_record(l) for l in leads]


@router.get("/queue", response_model=list[LeadRecord])
def get_action_queue(
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
) -> list[LeadRecord]:
    """
    Active (non-terminal) leads sorted by priority then age.
    High-priority oldest leads appear first — the order a rep should work.
    """
    priority_order = case(
        (Lead.priority == "high",   0),
        (Lead.priority == "medium", 1),
        else_=2,
    )
    leads = (
        db.query(Lead)
        .filter(Lead.status.notin_(list(_TERMINAL)))
        .order_by(priority_order, Lead.created_at.asc())
        .all()
    )
    return [_to_record(l) for l in leads]


# ── Routes — parameterised ────────────────────────────────────────────────────

@router.patch("/{lead_id}", response_model=LeadRecord)
def update_lead(
    lead_id: int,
    body: LeadUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin),
) -> LeadRecord:
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found.")

    # Status transition
    if body.status is not None and body.status != lead.status:
        allowed = VALID_TRANSITIONS.get(lead.status, frozenset())
        if body.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Cannot transition '{lead.status}' → '{body.status}'. "
                    f"Allowed: {sorted(allowed) or 'none (terminal state)'}."
                ),
            )
        log_event(db, lead.id, "status_changed",
                  old_value=lead.status, new_value=body.status,
                  performed_by_id=admin.id)

        # Track last contact time
        if body.status == "contacted":
            lead.last_contacted_at = datetime.now(timezone.utc)

        lead.status = body.status
        logger.info("lead.status id=%d %s→%s by=%s", lead.id, lead.status, body.status, admin.email)

    # Assignment
    if body.assigned_to_id is not None:
        old_id = lead.assigned_to_id
        if body.assigned_to_id == 0:
            lead.assigned_to_id = None
            log_event(db, lead.id, "unassigned",
                      old_value=str(old_id) if old_id else None,
                      performed_by_id=admin.id)
        else:
            assignee = db.get(User, body.assigned_to_id)
            if not assignee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User id={body.assigned_to_id} not found.",
                )
            lead.assigned_to_id = body.assigned_to_id
            log_event(db, lead.id, "assigned",
                      old_value=str(old_id) if old_id else None,
                      new_value=str(body.assigned_to_id),
                      performed_by_id=admin.id)
            logger.info("lead.assigned id=%d → user=%s by=%s", lead.id, assignee.email, admin.email)

    db.commit()
    db.refresh(lead)
    return _to_record(lead)


@router.get("/{lead_id}/events", response_model=list[LeadEventRecord])
def get_lead_events(
    lead_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(_require_admin),
) -> list[LeadEventRecord]:
    """Full audit trail for a single lead, newest first."""
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found.")

    events = (
        db.query(LeadEvent)
        .filter(LeadEvent.lead_id == lead_id)
        .order_by(LeadEvent.created_at.desc())
        .all()
    )
    return [_to_event_record(e) for e in events]
