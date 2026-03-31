"""
ml/features.py — Engineered features for credit risk ranking
Drop-in: call add_engineered_features(df) BEFORE pipeline.transform()

Goal: improve TOP SLICE ranking quality, not global AUC.
Each feature here is chosen because it predicts early default or
recovery — both of which directly affect rank_score in the simulation.
"""

import numpy as np
import pandas as pd


def add_engineered_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add derived features to a loan DataFrame.

    Parameters
    ----------
    df : raw or preprocessed loan DataFrame containing LendingClub columns.

    Returns
    -------
    df : copy with new feature columns appended.

    Usage
    -----
    X_features = add_engineered_features(X_features)
    X_t = pipeline.transform(X_features)
    """
    df = df.copy()

    # ── 1. Payment burden ────────────────────────────────────────────────────
    # Monthly payment as fraction of income.
    # High values → borrower is stretched → early default more likely.
    df["installment_to_income"] = df["installment"] / (df["annual_inc"] + 1)

    # ── 2. Revolving utilization ─────────────────────────────────────────────
    # Balance / limit. Near-maxed cards signal financial stress even when
    # DTI looks acceptable. +1 avoids divide-by-zero on zero-limit accounts.
    df["revolving_utilization"] = df["revol_bal"] / (df["revol_lim"] + 1)

    # ── 3. DTI adjusted for account depth ───────────────────────────────────
    # Raw DTI doesn't account for how many accounts carry that debt.
    # Borrowers with same DTI but fewer open accounts are more concentrated.
    df["debt_to_income_adj"] = df["dti"] * (df["open_acc"] / (df["total_acc"] + 1))

    # ── 4. Credit age ────────────────────────────────────────────────────────
    # Older credit history → more repayment track record → lower PD.
    # Coerce errors to NaT; age will be NaN for bad dates → imputed downstream.
    credit_age_days = (
        pd.to_datetime("today")
        - pd.to_datetime(df["earliest_cr_line"], errors="coerce")
    ).dt.days
    df["credit_age_yrs"] = credit_age_days / 365

    # ── 5. Delinquency density ───────────────────────────────────────────────
    # Delinquencies per year of credit history. A borrower with 2 delinquencies
    # in 20 years is very different from one with 2 in 3 years.
    df["delinq_density"] = df["delinq_2yrs"] / (df["credit_age_yrs"] + 1)

    return df


# ── Column reference (update FEATURE_COLS in schema.py to include these) ──────
ENGINEERED_COLS = [
    "installment_to_income",
    "revolving_utilization",
    "debt_to_income_adj",
    "credit_age_yrs",
    "delinq_density",
]
