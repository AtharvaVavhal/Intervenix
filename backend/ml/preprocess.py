"""
preprocess.py — Preprocessing + feature engineering for Lending Club data.

Design rules:
  1. Only columns in schema.FEATURE_COLS enter this module.
  2. All transformations are computable at origination time.
  3. No target, no LGD inputs, no post-origination data.
  4. Single source of truth for feature engineering: FeatureEngineer only.
  5. No StandardScaler — LightGBM is tree-based, scaling has no effect.
"""

from __future__ import annotations

import re

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder

from .schema import FEATURE_COLS, CLOSED_STATUSES, DEFAULT_STATUSES, TARGET_COL


# ── Constants ────────────────────────────────────────────────────────────────

GRADE_ORDER       = ["A", "B", "C", "D", "E", "F", "G"]
SUB_GRADE_ORDER   = [f"{g}{n}" for g in GRADE_ORDER for n in range(1, 6)]
HOME_OWNERSHIP_CATS   = ["RENT", "MORTGAGE", "OWN", "OTHER", "NONE", "ANY"]
VERIFICATION_CATS     = ["Not Verified", "Source Verified", "Verified"]
PURPOSE_CATS = [
    "debt_consolidation", "credit_card", "home_improvement", "other",
    "major_purchase", "small_business", "car", "wedding", "medical",
    "moving", "vacation", "house", "renewable_energy", "educational",
]

# Single canonical list — ColumnTransformer is built from this.
# Order is stable: numeric first, ordinal second.
NUMERIC_COLS = [
    # Loan terms
    "loan_amnt", "funded_amnt", "int_rate", "installment", "term_months",
    # Borrower income / employment
    "annual_inc", "emp_length_yrs",
    # Credit quality
    "fico_avg",                  # replaces fico_range_low + fico_range_high
    "dti", "revol_util", "revol_bal",
    "open_acc", "total_acc",
    "delinq_2yrs", "inq_last_6mths", "pub_rec",
    # Engineered: credit history
    "credit_age_months",         # kept as primary; credit_age_years derived from it
    # Engineered: ratios
    "payment_burden",            # installment / monthly_income (replaces installment_to_income)
    "funded_ratio",
    "loan_to_income",
    "credit_pressure",
    # Engineered: utilization
    "revol_util_x_dti",
    "util_per_account",
    "debt_per_account",
    # Engineered: risk signals
    "risk_interaction",          # dti * int_rate
    "int_rate_x_term",
    "inc_per_inquiry",
    "delinq_per_year",
    # Engineered: binary flags
    "has_delinquency",
    "has_pub_rec",
]

ORDINAL_COLS = [
    "grade", "sub_grade", "home_ownership", "verification_status", "purpose",
]

# Removed vs original:
#   installment_to_income  → duplicate of payment_burden (same formula)
#   credit_age_years       → credit_age_months / 12, redundant with credit_age_months
#   fico_range_low/high    → replaced by fico_avg alone


# ── Raw parsers ──────────────────────────────────────────────────────────────

def _parse_term(s) -> int:
    if pd.isna(s):
        return 36
    m = re.search(r"\d+", str(s))
    return int(m.group()) if m else 36


def _parse_emp_length(s) -> float:
    if pd.isna(s):
        return np.nan
    s = str(s).lower()
    if "10+" in s:
        return 10.0
    if "< 1" in s:
        return 0.0
    m = re.search(r"\d+", s)
    return float(m.group()) if m else np.nan


def _parse_pct(s) -> float:
    if pd.isna(s):
        return np.nan
    if isinstance(s, (int, float)):
        return float(s)
    return float(str(s).replace("%", "").strip())


def _parse_date(s, fmt: str = "%b-%Y") -> pd.Timestamp:
    if pd.isna(s):
        return pd.NaT
    return pd.to_datetime(s, format=fmt, errors="coerce")


# ── Target builder ───────────────────────────────────────────────────────────

def build_target(df: pd.DataFrame) -> tuple:
    mask   = df[TARGET_COL].isin(CLOSED_STATUSES)
    closed = df[mask].copy()
    y      = closed[TARGET_COL].isin(DEFAULT_STATUSES).astype(int)
    print(
        f"[Target] {mask.sum():,} closed loans kept. "
        f"Default rate: {y.mean():.1%}  ({y.sum():,} defaults)"
    )
    return closed.index, y


# ── LGD computation ──────────────────────────────────────────────────────────

def compute_lgd(df: pd.DataFrame) -> pd.Series:
    numerator = df["total_rec_prncp"].fillna(0) + df["recoveries"].fillna(0)
    lgd = 1 - (numerator / df["funded_amnt"].replace(0, np.nan))
    return lgd.clip(0, 1)


# ── Feature engineering transformer ─────────────────────────────────────────

class FeatureEngineer(BaseEstimator, TransformerMixin):
    """
    Single source of truth for all feature engineering.
    ml_features.py is NOT used — all features live here.
    Input:  raw DataFrame.
    Output: DataFrame with all columns in NUMERIC_COLS + ORDINAL_COLS populated.
    """

    def fit(self, X: pd.DataFrame, y=None):
        self.emp_length_median_ = X["emp_length"].apply(_parse_emp_length).median()
        self.annual_inc_median_ = pd.to_numeric(X["annual_inc"], errors="coerce").median()
        self.revol_util_median_ = (
            X["revol_util"].apply(_parse_pct).median()
            if X["revol_util"].dtype == object
            else X["revol_util"].median()
        )
        return self

    def transform(self, X: pd.DataFrame, y=None) -> pd.DataFrame:
        df = X.copy()

        # ── Parse raw strings ─────────────────────────────────────────────
        df["term_months"]   = df["term"].apply(_parse_term)
        df["emp_length_yrs"] = df["emp_length"].apply(_parse_emp_length).fillna(
            self.emp_length_median_
        )
        df["int_rate"]  = df["int_rate"].apply(_parse_pct)
        df["revol_util"] = df["revol_util"].apply(_parse_pct).fillna(self.revol_util_median_)
        df["annual_inc"] = pd.to_numeric(df["annual_inc"], errors="coerce").fillna(
            self.annual_inc_median_
        )

        # ── Credit age ────────────────────────────────────────────────────
        issue    = df["issue_d"].apply(lambda s: _parse_date(s, "%b-%Y"))
        earliest = df["earliest_cr_line"].apply(lambda s: _parse_date(s, "%b-%Y"))
        df["credit_age_months"] = (
            (issue - earliest).dt.days / 30.44
        ).clip(lower=0).fillna(0)
        credit_age_years = df["credit_age_months"] / 12  # local only — not a model feature

        # ── FICO average (single feature, replaces low + high) ────────────
        df["fico_avg"] = (
            pd.to_numeric(df["fico_range_low"], errors="coerce") +
            pd.to_numeric(df["fico_range_high"], errors="coerce")
        ) / 2

        # ── Income base ───────────────────────────────────────────────────
        monthly_inc = df["annual_inc"].replace(0, np.nan) / 12

        # ── Ratios ────────────────────────────────────────────────────────
        # payment_burden: replaces installment_to_income (same formula, one name)
        df["payment_burden"] = (
            df["installment"] / monthly_inc
        ).clip(0, 10).fillna(0)

        df["funded_ratio"] = (
            df["funded_amnt"] / df["loan_amnt"].replace(0, np.nan)
        ).clip(0, 1).fillna(1.0)

        df["loan_to_income"] = (
            df["loan_amnt"] / (df["annual_inc"] + 1)
        ).clip(0, 10).fillna(0)

        df["credit_pressure"] = (
            df["revol_bal"] / (df["annual_inc"] + 1)
        ).clip(0, 10).fillna(0)

        # ── Utilization signals ───────────────────────────────────────────
        df["revol_util_x_dti"] = df["revol_util"].fillna(0) * df["dti"].fillna(0)

        df["util_per_account"] = (
            df["revol_util"].fillna(0) / (df["open_acc"].fillna(1) + 1)
        ).clip(0, 100)

        df["debt_per_account"] = (
            df["revol_bal"] / (df["open_acc"].fillna(1) + 1)
        ).clip(0, 1e6).fillna(0)

        # ── Risk signals ──────────────────────────────────────────────────
        df["risk_interaction"] = df["dti"].fillna(0) * df["int_rate"].fillna(0)
        df["int_rate_x_term"]  = df["int_rate"].fillna(0) * df["term_months"]

        df["inc_per_inquiry"] = (
            df["annual_inc"] / (df["inq_last_6mths"].fillna(0) + 1)
        ).clip(0, 1e7)

        df["delinq_per_year"] = (
            pd.to_numeric(df["delinq_2yrs"], errors="coerce").fillna(0)
            / (credit_age_years + 1)
        ).clip(0, 10)

        # ── Binary flags ──────────────────────────────────────────────────
        df["has_delinquency"] = (
            pd.to_numeric(df["delinq_2yrs"], errors="coerce").fillna(0) > 0
        ).astype(int)

        df["has_pub_rec"] = (
            pd.to_numeric(df["pub_rec"], errors="coerce").fillna(0) > 0
        ).astype(int)

        # ── Ordinal cleanup ───────────────────────────────────────────────
        df["grade"]               = df["grade"].fillna("G")
        df["sub_grade"]           = df["sub_grade"].fillna("G5")
        df["home_ownership"]      = df["home_ownership"].fillna("OTHER")
        df["verification_status"] = df["verification_status"].fillna("Not Verified")
        df["purpose"]             = df["purpose"].fillna("other")

        # ── Validation: confirm all model columns are present ─────────────
        all_cols    = NUMERIC_COLS + ORDINAL_COLS
        missing     = [c for c in all_cols if c not in df.columns]
        if missing:
            raise ValueError(f"FeatureEngineer: missing output columns: {missing}")

        print(f"[FeatureEngineer] Output: {len(df)} rows × "
              f"{len(NUMERIC_COLS)} numeric + {len(ORDINAL_COLS)} ordinal features")

        return df


# ── Column transformer ───────────────────────────────────────────────────────

def build_preprocessor() -> ColumnTransformer:
    """
    ColumnTransformer: passthrough for numeric (trees don't need scaling),
    OrdinalEncoder for categoricals.
    """
    ordinal_pipe = Pipeline([
        ("encoder", OrdinalEncoder(
            categories=[
                GRADE_ORDER,
                SUB_GRADE_ORDER,
                HOME_OWNERSHIP_CATS,
                VERIFICATION_CATS,
                PURPOSE_CATS,
            ],
            handle_unknown="use_encoded_value",
            unknown_value=-1,
        )),
    ])

    ct = ColumnTransformer(
        transformers=[
            ("num", "passthrough", NUMERIC_COLS),   # no scaling for LightGBM
            ("ord", ordinal_pipe,  ORDINAL_COLS),
        ],
        remainder="drop",
    )

    n_expected = len(NUMERIC_COLS) + len(ORDINAL_COLS)
    print(f"[build_preprocessor] Expected output width: {n_expected} features "
          f"({len(NUMERIC_COLS)} numeric + {len(ORDINAL_COLS)} ordinal)")
    return ct


def build_full_pipeline() -> Pipeline:
    return Pipeline([
        ("engineer",     FeatureEngineer()),
        ("preprocessor", build_preprocessor()),
    ])