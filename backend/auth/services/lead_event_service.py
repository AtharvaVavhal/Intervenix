"""Audit log helpers — always call before db.commit() in the same session."""
import logging
from sqlalchemy.orm import Session
from ..models.lead_event import LeadEvent

logger = logging.getLogger(__name__)


def log_event(
    db:               Session,
    lead_id:          int,
    action:           str,
    old_value:        str | None = None,
    new_value:        str | None = None,
    performed_by_id:  int | None = None,   # None = system
) -> None:
    """
    Append an audit event.  Does NOT commit — caller owns the transaction.
    """
    event = LeadEvent(
        lead_id         = lead_id,
        action          = action,
        old_value       = old_value,
        new_value       = new_value,
        performed_by_id = performed_by_id,
    )
    db.add(event)
    logger.debug(
        "lead_event lead_id=%d action=%s %r→%r by=%s",
        lead_id, action, old_value, new_value, performed_by_id,
    )
