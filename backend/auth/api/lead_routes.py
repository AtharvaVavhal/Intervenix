import logging
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.lead import Lead

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/lead", tags=["lead"])


# ── Request schema ────────────────────────────────────────────────────────────

class LeadRequest(BaseModel):
    name:               str
    email:              EmailStr
    company:            str
    role:               str
    volume:             str
    use_case:           str
    problem:            str
    stack:              str
    notes:              str = ""
    callback_requested: bool = False

    @field_validator("name", "company", "role", "volume", "use_case", "problem", "stack")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Field cannot be empty")
        return v.strip()


# ── Response schema ───────────────────────────────────────────────────────────

class LeadResponse(BaseModel):
    status: str
    id:     int


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post(
    "/talk-to-engineer",
    response_model=LeadResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_lead(body: LeadRequest, db: Session = Depends(get_db)) -> LeadResponse:
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
    db.add(lead)
    db.commit()
    db.refresh(lead)

    logger.info(
        "New lead: id=%d email=%s company=%s callback=%s",
        lead.id, lead.email, lead.company, lead.callback_requested,
    )

    return LeadResponse(status="ok", id=lead.id)
