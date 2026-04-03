import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from .auth_routes import get_current_user
from ..models.user import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ── Response schema ───────────────────────────────────────────────────────────

class ModelHealth(BaseModel):
    psi:    float
    ece:    float
    status: str   # "nominal" | "warning" | "critical"


class DashboardSummary(BaseModel):
    model_config = {"protected_namespaces": ()}

    user_email:        str
    total_portfolio:   int
    high_risk:         int
    medium_risk:       int
    low_risk:          int
    expected_recovery: int
    model_health:      ModelHealth


# ── Route ─────────────────────────────────────────────────────────────────────

@router.get("/summary", response_model=DashboardSummary)
def get_summary(current_user: User = Depends(get_current_user)) -> DashboardSummary:
    """
    Returns portfolio summary for the authenticated user.

    Currently returns representative static values derived from the trained
    XGBoost model's validation set distribution. Wire to live DB queries
    once per-user portfolio tables are added.
    """
    logger.info("Dashboard summary requested by user id=%d", current_user.id)

    return DashboardSummary(
        user_email        = current_user.email,
        total_portfolio   = 4000,
        high_risk         = 320,
        medium_risk       = 870,
        low_risk          = 2810,
        expected_recovery = 1_820_000,
        model_health      = ModelHealth(
            psi    = 0.08,
            ece    = 0.024,
            status = "nominal",
        ),
    )
