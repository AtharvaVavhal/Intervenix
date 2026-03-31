# ── simulate.py — Run in Colab after training ────────────────────────────────
#
# Prerequisites:
#   - result = train(df_model, ...) has been run
#   - df is loaded (the full CSV)
#   - models/ folder exists with saved artifacts
#
# Run this entire cell at once.

import sys
import numpy as np
import pandas as pd
import joblib

# Force fresh imports
for key in list(sys.modules.keys()):
    if key.startswith("ml"):
        del sys.modules[key]

from ml.preprocess import build_target, compute_lgd
from ml.leakage_guard import drop_disallowed
from ml.schema import FEATURE_COLS, TARGET_COL, LGD_COLS
from ml.engine import (
    UnderwritingInput,
    simulate_portfolio,
    compare_strategies,
    break_even_analysis,
)

# ── Step 1: Load saved model artifacts ───────────────────────────────────────
pipeline   = joblib.load("models/feature_pipeline.joblib")
xgb        = joblib.load("models/xgboost_model.joblib")
calibrator = joblib.load("models/isotonic_calibrator.joblib")
print("✅ Artifacts loaded.")

# ── Step 2: Build scored dataset ─────────────────────────────────────────────
# Use closed loans only (same as training)
kept_idx, y_actual = build_target(df)
df_closed = df.loc[kept_idx].copy()

# Score: get PD for every closed loan
X_features = drop_disallowed(df_closed)
X_t        = pipeline.transform(X_features)
raw_probs  = xgb.predict_proba(X_t)[:, 1]
pd_scores  = calibrator.predict(raw_probs)

print(f"✅ Scored {len(pd_scores):,} loans.")
print(f"   Mean PD: {pd_scores.mean():.3f}  |  Actual default rate: {y_actual.mean():.3f}")

# ── Step 3: Compute LGD ───────────────────────────────────────────────────────
# LGD uses post-origination recovery data — valid here because we're
# evaluating historical decisions, not making live predictions
lgd_scores = compute_lgd(df_closed).values
print(f"   Mean LGD: {np.nanmean(lgd_scores):.3f}")

# ── Step 4: Parse int_rate and term ──────────────────────────────────────────
import re

def parse_int_rate(s):
    """'13.56%' → 0.1356"""
    try:
        if isinstance(s, float):
            return s / 100 if s > 1 else s
        return float(str(s).replace("%", "").strip()) / 100
    except:
        return np.nan

def parse_term(s):
    """' 36 months' → 36"""
    try:
        m = re.search(r"\d+", str(s))
        return int(m.group()) if m else 36
    except:
        return 36

int_rates = df_closed["int_rate"].apply(parse_int_rate).fillna(df_closed["int_rate"].apply(parse_int_rate).median())
terms     = df_closed["term"].apply(parse_term)

# ── Step 5: Build simulation DataFrame ───────────────────────────────────────
sim_df = pd.DataFrame({
    "loan_id":        range(len(df_closed)),
    "pd":             pd_scores,
    "lgd":            np.clip(lgd_scores, 0, 1),
    "loan_amnt":      df_closed["loan_amnt"].values,
    "int_rate":       int_rates.values,
    "term":           terms.values,
    "actual_default": y_actual.values,
}).dropna()

print(f"\n✅ Simulation dataset: {len(sim_df):,} loans")
print(f"   Loan amount range: ${sim_df['loan_amnt'].min():,.0f} – ${sim_df['loan_amnt'].max():,.0f}")
print(f"   Int rate range:    {sim_df['int_rate'].min():.1%} – {sim_df['int_rate'].max():.1%}")
print(f"   Term mix:          {sim_df['term'].value_counts().to_dict()}")

# ── Step 6: Compare strategies ────────────────────────────────────────────────
summary = compare_strategies(
    sim_df,
    pd_thresholds=[0.15, 0.20, 0.25],
)

# ── Step 7: Break-even analysis ───────────────────────────────────────────────
be_df = break_even_analysis(sim_df)
print(f"\n✅ Break-even analysis:")
print(f"   Profitable loans (PD < break-even PD): {be_df['profitable'].mean():.1%}")
print(f"   Mean PD headroom: {be_df['pd_headroom'].mean():.3f}")
print(f"   Loans with < 0 headroom: {(~be_df['profitable']).sum():,}")

# ── Step 8: Profit-based decisions deep dive ──────────────────────────────────
decisions_df, profit_result = simulate_portfolio(sim_df, strategy="profit_based")

print(f"\n{'='*55}")
print(f"  PROFIT-BASED STRATEGY — DEEP DIVE")
print(f"{'='*55}")
print(f"  Approved      : {profit_result.total_approved:,}")
print(f"  Conditional   : {profit_result.total_conditional:,}")
print(f"  Rejected      : {profit_result.total_rejected:,}")
print(f"  Approval rate : {profit_result.approval_rate:.1%}")
print(f"  Default rate  : {profit_result.expected_default_rate:.1%}  (approved loans)")
print(f"  Total profit  : ${profit_result.total_expected_profit:,.0f}")
print(f"  Total revenue : ${profit_result.total_expected_revenue:,.0f}")
print(f"  Total loss    : ${profit_result.total_expected_loss:,.0f}")
print(f"  Profit/loan   : ${profit_result.profit_per_loan:,.0f}")
print(f"  ROI           : {profit_result.roi:.2%}")

# ── Step 9: Risk tier breakdown ───────────────────────────────────────────────
print(f"\n✅ Risk tier breakdown (profit-based, approved only):")
approved_df = decisions_df[decisions_df["decision"] == "approve"]
tier_summary = approved_df.groupby("risk_tier").agg(
    count=("loan_id", "count"),
    avg_pd=("pd", "mean"),
    avg_profit=("profit", "mean"),
    total_profit=("profit", "sum"),
    actual_default_rate=("actual_default", "mean"),
).round(4)
print(tier_summary.to_string())
