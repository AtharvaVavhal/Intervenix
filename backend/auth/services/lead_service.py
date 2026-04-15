"""Lead scoring and email notification."""
import logging
import smtplib
import textwrap
from email.mime.text import MIMEText

from ..core.config import get_settings
from ..models.lead import Lead

logger = logging.getLogger(__name__)

# ── Scoring constants ─────────────────────────────────────────────────────────

_HIGH_VOLUME_THRESHOLD = 1_000_000

_ROLE_SCORES: dict[str, int] = {
    "engineering": 20,
    "data":        20,
}

_USE_CASE_SCORES: dict[str, int] = {
    "fraud": 20,
}

_CALLBACK_BONUS = 10


# ── Public API ────────────────────────────────────────────────────────────────

def score_lead(lead: Lead) -> None:
    """Compute and set lead_score + priority in-place. Never raises."""
    lead.lead_score = _compute_score(lead)
    lead.priority   = _compute_priority(lead.lead_score)


# ── Scoring internals ─────────────────────────────────────────────────────────

def _compute_score(lead: Lead) -> int:
    score = 0

    # Volume > 1M txn/month → +50
    try:
        vol = int(lead.volume)
        if vol > _HIGH_VOLUME_THRESHOLD:
            score += 50
    except (TypeError, ValueError):
        logger.warning("lead id=%s: could not parse volume %r for scoring", lead.id, lead.volume)

    # Role bonus
    role = (lead.role or "").strip().lower()
    score += _ROLE_SCORES.get(role, 0)

    # Use-case bonus
    use_case = (lead.use_case or "").strip().lower()
    score += _USE_CASE_SCORES.get(use_case, 0)

    # Callback requested → +10
    if lead.callback_requested:
        score += _CALLBACK_BONUS

    return score


def _compute_priority(score: int) -> str:
    if score >= 60:
        return "high"
    if score >= 30:
        return "medium"
    return "low"


# ── Email ─────────────────────────────────────────────────────────────────────

def send_lead_notification(lead: Lead) -> None:
    """
    Fire-and-forget email notification.
    Logs a warning on failure but never raises — the HTTP request must not
    block on SMTP.
    """
    settings = get_settings()

    if not all([settings.SMTP_HOST, settings.SMTP_USER, settings.SMTP_PASS, settings.NOTIFY_EMAIL]):
        logger.debug("Email not configured — skipping notification for lead id=%s", lead.id)
        return

    priority_upper = lead.priority.upper()
    subject = f"New Intervenix Lead — {priority_upper} Priority"

    body = textwrap.dedent(f"""\
        A new lead was submitted via Talk to Engineer.

        ── Identity ──────────────────────────────
        Name:      {lead.name}
        Email:     {lead.email}
        Company:   {lead.company}
        Role:      {lead.role}

        ── Opportunity ───────────────────────────
        Volume:    {lead.volume:,} txn/month
        Use Case:  {lead.use_case}
        Problem:   {lead.problem}

        ── Score ─────────────────────────────────
        Score:     {lead.lead_score} / 100
        Priority:  {priority_upper}
        Callback:  {"Requested" if lead.callback_requested else "No"}

        ──────────────────────────────────────────
        Review all leads → /admin/leads
    """)

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"]    = settings.SMTP_USER
    msg["To"]      = settings.NOTIFY_EMAIL

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASS)
            smtp.sendmail(settings.SMTP_USER, [settings.NOTIFY_EMAIL], msg.as_string())
        logger.info(
            "Lead notification sent: id=%s priority=%s → %s",
            lead.id, lead.priority, settings.NOTIFY_EMAIL,
        )
    except smtplib.SMTPAuthenticationError:
        logger.warning(
            "Lead email auth failed for id=%s — check SMTP_USER / SMTP_PASS",
            lead.id,
        )
    except smtplib.SMTPException as exc:
        logger.warning("Lead email SMTP error for id=%s: %s", lead.id, exc)
    except OSError as exc:
        logger.warning("Lead email network error for id=%s: %s", lead.id, exc)
