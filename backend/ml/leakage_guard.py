"""
leakage_guard.py — Raises immediately if post-origination data
enters the training pipeline. Import and call enforce() as the
first step after loading raw data.
"""

from __future__ import annotations

import pandas as pd

from .schema import POST_ORIGINATION_COLS, FEATURE_COLS, TARGET_COL


class LeakageError(Exception):
    """Raised when post-origination columns are found in a DataFrame."""


def enforce(df: pd.DataFrame, context: str = "unknown") -> None:
    """
    Raise LeakageError if any post-origination column exists in df.

    Parameters
    ----------
    df      : The DataFrame being checked.
    context : Human-readable label for the error message (e.g. 'train split').
    """
    found = [c for c in POST_ORIGINATION_COLS if c in df.columns]
    if found:
        raise LeakageError(
            f"[LeakageGuard] Post-origination columns found in '{context}': {found}. "
            "Remove them before proceeding."
        )


def enforce_feature_only(df: pd.DataFrame, context: str = "model input") -> None:
    """
    Stricter check: df must contain ONLY allowed feature columns.
    Raises LeakageError on any unexpected column.

    Use this on the X matrix right before fitting.
    """
    unexpected = [c for c in df.columns if c not in FEATURE_COLS]
    if unexpected:
        raise LeakageError(
            f"[LeakageGuard] Unexpected columns in '{context}': {unexpected}. "
            f"Only {FEATURE_COLS} are permitted."
        )


def drop_disallowed(df: pd.DataFrame) -> pd.DataFrame:
    """
    Drop all columns that are not in FEATURE_COLS + TARGET_COL.
    Returns the filtered DataFrame. Does NOT mutate in place.
    """
    allowed = set(FEATURE_COLS) | {TARGET_COL}
    cols_to_keep = [c for c in df.columns if c in allowed]
    dropped = [c for c in df.columns if c not in allowed]
    if dropped:
        print(f"[LeakageGuard] Dropped {len(dropped)} disallowed columns: {dropped[:10]}{'...' if len(dropped) > 10 else ''}")
    return df[cols_to_keep].copy()
