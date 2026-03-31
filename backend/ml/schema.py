"""
schema.py — Single source of truth for allowed columns.
Any code that touches raw Lending Club data MUST import from here.
"""

# ── Model features (pre-origination only) ──────────────────────────────────
FEATURE_COLS = [
    # Borrower profile
    "annual_inc",
    "emp_length",
    "home_ownership",
    "verification_status",
    # Credit bureau snapshot
    "fico_range_low",
    "fico_range_high",
    "dti",
    "revol_util",
    "revol_bal",
    "open_acc",
    "total_acc",
    "delinq_2yrs",
    "inq_last_6mths",
    "pub_rec",
    "earliest_cr_line",
    # Loan terms (set at origination)
    "loan_amnt",
    "funded_amnt",
    "term",
    "int_rate",
    "installment",
    "grade",
    "sub_grade",
    "purpose",
    "issue_d",
]

# ── Target ─────────────────────────────────────────────────────────────────
TARGET_COL = "loan_status"

# ── LGD inputs (NOT fed to model — used only for EV computation) ───────────
LGD_COLS = [
    "total_rec_prncp",
    "recoveries",
    "funded_amnt",  # also in features but used independently here
]

# ── All columns we ever read from disk ─────────────────────────────────────
ALLOWED_COLS = FEATURE_COLS + [TARGET_COL] + [
    c for c in LGD_COLS if c not in FEATURE_COLS
]

# ── Post-origination columns that MUST NEVER appear in training data ────────
# This list is a hard blacklist — extend it as you discover more.
POST_ORIGINATION_COLS = [
    "total_pymnt",
    "total_pymnt_inv",
    "total_rec_int",
    "total_rec_late_fee",
    "total_rec_prncp",
    "recoveries",
    "collection_recovery_fee",
    "last_pymnt_d",
    "last_pymnt_amnt",
    "next_pymnt_d",
    "last_credit_pull_d",
    "out_prncp",
    "out_prncp_inv",
    "mths_since_last_delinq",
    "mths_since_last_record",
    "mths_since_last_major_derog",
]

# ── Loan statuses that map to default (90+ DPD equivalent) ─────────────────
DEFAULT_STATUSES = {
    "Charged Off",
    "Default",
    "Does not meet the credit policy. Status:Charged Off",
}

# ── Loan statuses we keep (exclude in-progress loans) ──────────────────────
CLOSED_STATUSES = DEFAULT_STATUSES | {
    "Fully Paid",
    "Does not meet the credit policy. Status:Fully Paid",
}
