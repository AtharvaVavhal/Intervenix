"""
ml/lgd.py — Segmented LGD, drop-in replacement for compute_lgd() in preprocess.py.

Replace:
    lgd_scores = compute_lgd(df_closed).values
With:
    lgd_scores = compute_lgd_segmented(df_closed).values

simulate.py requires no other changes.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# Conditions evaluated first-match-wins (np.select order).
# Multiplier < 1 → better recovery, < expected loss.
# Multiplier > 1 → worse recovery, > expected loss.
_SEGMENTS: list[tuple] = [
    # condition_key,         condition_value,   multiplier
    ("home_ownership+purpose", ("OWN",  "debt_consolidation"), 0.80),
    ("home_ownership",         "OWN",                          0.85),
    ("home_ownership",         "MORTGAGE",                     0.95),
    ("purpose",                "debt_consolidation",           0.95),
    ("purpose",                "small_business",               1.25),
    ("home_ownership",         "RENT",                         1.10),
]


def compute_lgd_segmented(df: pd.DataFrame) -> pd.Series:
    """
    Segmented LGD using recovery data + borrower segment multipliers.
    Returns pd.Series of float in [0, 1], same index as df.
    """
    df = df.copy()
    numerator = df["total_rec_prncp"].fillna(0) + df["recoveries"].fillna(0)
    base_lgd  = 1.0 - (numerator / df["funded_amnt"].replace(0, np.nan))

    conditions, adjustments = [], []
    for key, val, mult in _SEGMENTS:
        if key == "home_ownership+purpose":
            own_val, pur_val = val
            conditions.append(
                (df["home_ownership"] == own_val) & (df["purpose"] == pur_val)
            )
        elif key == "home_ownership":
            conditions.append(df["home_ownership"] == val)
        elif key == "purpose":
            conditions.append(df["purpose"] == val)
        adjustments.append(mult)

    multiplier = np.select(conditions, adjustments, default=1.0)
    lgd        = base_lgd * multiplier
    return pd.Series(np.clip(lgd, 0.0, 1.0), index=df.index, name="lgd")


def lgd_segment_summary(df: pd.DataFrame) -> pd.DataFrame:
    """Diagnostic: mean LGD per segment. Run once to verify recoveries column is populated."""
    df = df.copy()
    df["lgd_seg"] = compute_lgd_segmented(df)

    seg = pd.Series("other", index=df.index)
    for key, val, _ in reversed(_SEGMENTS):
        if key == "home_ownership+purpose":
            own_val, pur_val = val
            mask = (df["home_ownership"] == own_val) & (df["purpose"] == pur_val)
            label = f"own+{pur_val}"
        elif key == "home_ownership":
            mask, label = df["home_ownership"] == val, f"own={val}"
        else:
            mask, label = df["purpose"] == val, f"purpose={val}"
        seg[mask] = label

    df["segment"] = seg
    return (
        df.groupby("segment")["lgd_seg"]
        .agg(count="count", mean_lgd="mean")
        .sort_values("mean_lgd")
    )