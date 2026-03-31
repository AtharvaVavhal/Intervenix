"""
engine.py — Credit Underwriting Decision Engine.

STRICT LAYER SEPARATION:
  - Receives p_calibrated (PD) from the model layer.
  - Receives LGD, loan_amnt, int_rate, term from the data layer.
  - All economic logic lives here and only here.
  - Never calls the model. Never touches training data.

Core formula:
  expected_loss    = PD * LGD * loan_amnt
  expected_revenue = int_rate * loan_amnt * (term_months / 12)
  profit           = expected_revenue - expected_loss

Decision tiers:
  profit > 0              → approve
  profit in (-margin, 0]  → conditional (reprice or reduce amount)
  profit <= -margin       → reject
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd


# ── Types ────────────────────────────────────────────────────────────────────

Decision = Literal["approve", "conditional", "reject"]

# Conditional band: loans within this fraction of break-even get reviewed
# e.g. 0.05 means profit in (-5% of revenue, 0] → conditional
CONDITIONAL_MARGIN = 0.05


# ── Dataclasses ──────────────────────────────────────────────────────────────

@dataclass
class UnderwritingInput:
    """
    One loan application at decision time.

    Parameters
    ----------
    loan_id   : Unique identifier.
    pd        : Calibrated P(default) from scorer. Must be in [0, 1].
    lgd       : Loss Given Default. Must be in [0, 1].
    loan_amnt : Requested loan amount in dollars.
    int_rate  : Annual interest rate as decimal (e.g. 0.13 for 13%).
    term      : Loan term in months (36 or 60).
    """
    loan_id:   int
    pd:        float
    lgd:       float
    loan_amnt: float
    int_rate:  float   # decimal, NOT percentage
    term:      int     # months


@dataclass
class UnderwritingResult:
    """Output for one loan application."""
    loan_id:          int
    pd:               float
    lgd:              float
    loan_amnt:        float
    int_rate:         float
    term:             int
    expected_loss:    float
    expected_revenue: float
    profit:           float
    profit_margin:    float   # profit / expected_revenue
    decision:         Decision
    risk_tier:        str     # low / medium / high / critical


@dataclass
class PortfolioResult:
    """Aggregated results for a strategy simulation."""
    strategy:              str
    total_applications:    int
    total_approved:        int
    total_conditional:     int
    total_rejected:        int
    approval_rate:         float
    expected_default_rate: float   # among approved
    total_expected_profit: float
    total_expected_loss:   float
    total_expected_revenue: float
    profit_per_loan:       float
    roi:                   float   # total_profit / total_loan_volume


# ── Core functions ────────────────────────────────────────────────────────────

def compute_profit(x: UnderwritingInput) -> tuple[float, float, float]:
    """
    Compute expected profit for a single loan application.

    Returns
    -------
    (expected_loss, expected_revenue, profit)
    """
    if not (0.0 <= x.pd <= 1.0):
        raise ValueError(f"pd must be in [0,1], got {x.pd}")
    if x.loan_amnt <= 0:
        raise ValueError(f"loan_amnt must be > 0, got {x.loan_amnt}")
    if x.int_rate <= 0:
        raise ValueError(f"int_rate must be > 0, got {x.int_rate}")
    if x.term <= 0:
        raise ValueError(f"term must be > 0, got {x.term}")

    # Clip LGD to [0, 1] — never trust raw LGD values
    lgd = float(np.clip(x.lgd, 0.0, 1.0))

    expected_loss    = x.pd * lgd * x.loan_amnt
    expected_revenue = x.int_rate * x.loan_amnt * (x.term / 12)
    profit           = expected_revenue - expected_loss

    return expected_loss, expected_revenue, profit


def assign_decision(
    profit: float,
    expected_revenue: float,
    margin: float = CONDITIONAL_MARGIN,
) -> Decision:
    """
    Three-tier decision logic.

    approve     : profit > 0
    conditional : profit in (-(margin * revenue), 0]
                  → borderline loans: reprice, reduce amount, or add conditions
    reject      : profit <= -(margin * revenue)

    The conditional band catches near-break-even loans that shouldn't be
    hard-rejected — they may be profitable with adjusted terms.
    """
    if profit > 0:
        return "approve"
    elif profit > -(margin * abs(expected_revenue)):
        return "conditional"
    else:
        return "reject"


def assign_risk_tier(pd: float) -> str:
    """Risk tier based on PD."""
    if pd < 0.10:
        return "low"
    elif pd < 0.20:
        return "medium"
    elif pd < 0.35:
        return "high"
    else:
        return "critical"


def underwrite(
    x: UnderwritingInput,
    margin: float = CONDITIONAL_MARGIN,
) -> UnderwritingResult:
    """
    Full underwriting decision for a single loan application.
    """
    expected_loss, expected_revenue, profit = compute_profit(x)

    profit_margin = profit / expected_revenue if expected_revenue > 0 else -999.0
    decision      = assign_decision(profit, expected_revenue, margin)
    risk_tier     = assign_risk_tier(x.pd)

    return UnderwritingResult(
        loan_id=x.loan_id,
        pd=x.pd,
        lgd=float(np.clip(x.lgd, 0.0, 1.0)),
        loan_amnt=x.loan_amnt,
        int_rate=x.int_rate,
        term=x.term,
        expected_loss=round(expected_loss, 2),
        expected_revenue=round(expected_revenue, 2),
        profit=round(profit, 2),
        profit_margin=round(profit_margin, 4),
        decision=decision,
        risk_tier=risk_tier,
    )


# ── Portfolio simulation ──────────────────────────────────────────────────────

def simulate_portfolio(
    df: pd.DataFrame,
    strategy: str = "profit_based",
    pd_threshold: float = 0.20,
    margin: float = CONDITIONAL_MARGIN,
) -> tuple[pd.DataFrame, PortfolioResult]:
    """
    Simulate underwriting decisions across a portfolio.

    Parameters
    ----------
    df : DataFrame with columns:
         loan_id, pd, lgd, loan_amnt, int_rate (decimal), term (months),
         actual_default (0/1) — for validation only, not used in decision.

    strategy : One of:
        "approve_all"    — baseline: approve every loan
        "pd_threshold"   — naive: reject if pd >= pd_threshold
        "profit_based"   — your system: approve only if profit > 0

    pd_threshold : Used only when strategy="pd_threshold".
    margin       : Conditional band size (fraction of revenue).

    Returns
    -------
    (decisions_df, PortfolioResult)
    """
    required = {"loan_id", "pd", "lgd", "loan_amnt", "int_rate", "term"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    rows = []
    for _, row in df.iterrows():
        x = UnderwritingInput(
            loan_id=int(row["loan_id"]),
            pd=float(row["pd"]),
            lgd=float(row["lgd"]),
            loan_amnt=float(row["loan_amnt"]),
            int_rate=float(row["int_rate"]),
            term=int(row["term"]),
        )

        el, rev, profit = compute_profit(x)
        risk_tier = assign_risk_tier(x.pd)
        profit_margin = profit / rev if rev > 0 else -999.0

        # Apply strategy
        if strategy == "approve_all":
            decision = "approve"
        elif strategy == "pd_threshold":
            decision = "approve" if x.pd < pd_threshold else "reject"
        else:  # profit_based
            decision = assign_decision(profit, rev, margin)

        rows.append({
            "loan_id":          x.loan_id,
            "pd":               x.pd,
            "lgd":              float(np.clip(x.lgd, 0.0, 1.0)),
            "loan_amnt":        x.loan_amnt,
            "int_rate":         x.int_rate,
            "term":             x.term,
            "expected_loss":    round(el, 2),
            "expected_revenue": round(rev, 2),
            "profit":           round(profit, 2),
            "profit_margin":    round(profit_margin, 4),
            "decision":         decision,
            "risk_tier":        risk_tier,
            "actual_default":   int(row.get("actual_default", -1)),
        })

    decisions_df = pd.DataFrame(rows)

    # ── Aggregate metrics ────────────────────────────────────────────────────
    approved = decisions_df[decisions_df["decision"].isin(["approve", "conditional"])]
    rejected = decisions_df[decisions_df["decision"] == "reject"]

    total       = len(decisions_df)
    n_approved  = (decisions_df["decision"] == "approve").sum()
    n_cond      = (decisions_df["decision"] == "conditional").sum()
    n_rejected  = (decisions_df["decision"] == "reject").sum()

    total_profit  = approved["profit"].sum()
    total_loss    = approved["expected_loss"].sum()
    total_revenue = approved["expected_revenue"].sum()
    total_volume  = approved["loan_amnt"].sum()

    # Default rate among approved (uses actual_default if available)
    if approved["actual_default"].eq(-1).all():
        exp_default_rate = approved["pd"].mean() if len(approved) > 0 else 0.0
    else:
        exp_default_rate = approved["actual_default"].mean() if len(approved) > 0 else 0.0

    roi = total_profit / total_volume if total_volume > 0 else 0.0

    result = PortfolioResult(
        strategy=strategy,
        total_applications=total,
        total_approved=int(n_approved),
        total_conditional=int(n_cond),
        total_rejected=int(n_rejected),
        approval_rate=round((n_approved + n_cond) / total, 4) if total > 0 else 0.0,
        expected_default_rate=round(float(exp_default_rate), 4),
        total_expected_profit=round(float(total_profit), 2),
        total_expected_loss=round(float(total_loss), 2),
        total_expected_revenue=round(float(total_revenue), 2),
        profit_per_loan=round(float(total_profit / (n_approved + n_cond)), 2) if (n_approved + n_cond) > 0 else 0.0,
        roi=round(float(roi), 4),
    )

    return decisions_df, result


# ── Strategy comparison ───────────────────────────────────────────────────────

def compare_strategies(
    df: pd.DataFrame,
    pd_thresholds: list[float] = [0.15, 0.20, 0.25],
    margin: float = CONDITIONAL_MARGIN,
) -> pd.DataFrame:
    """
    Compare all strategies and print a clean summary table.

    Parameters
    ----------
    df             : Same format as simulate_portfolio.
    pd_thresholds  : List of PD thresholds to test for naive strategy.
    margin         : Conditional band for profit-based strategy.

    Returns
    -------
    DataFrame with one row per strategy, sorted by total_expected_profit.
    """
    results = []

    # Baseline: approve all
    _, r = simulate_portfolio(df, strategy="approve_all")
    results.append(r)

    # Naive PD threshold — test multiple cutoffs
    for thresh in pd_thresholds:
        _, r = simulate_portfolio(df, strategy="pd_threshold", pd_threshold=thresh)
        r.strategy = f"pd_threshold_{thresh}"
        results.append(r)

    # Profit-based
    _, r = simulate_portfolio(df, strategy="profit_based", margin=margin)
    results.append(r)

    summary = pd.DataFrame([{
        "strategy":              r.strategy,
        "approval_rate":         f"{r.approval_rate:.1%}",
        "expected_default_rate": f"{r.expected_default_rate:.1%}",
        "total_profit ($)":      f"{r.total_expected_profit:,.0f}",
        "total_loss ($)":        f"{r.total_expected_loss:,.0f}",
        "total_revenue ($)":     f"{r.total_expected_revenue:,.0f}",
        "profit_per_loan ($)":   f"{r.profit_per_loan:,.0f}",
        "roi":                   f"{r.roi:.2%}",
    } for r in results])

    print("\n" + "="*90)
    print("  STRATEGY COMPARISON")
    print("="*90)
    print(summary.to_string(index=False))
    print("="*90)

    return summary


# ── Break-even analysis ───────────────────────────────────────────────────────

def break_even_pd(lgd: float, int_rate: float, term: int) -> float:
    """
    Maximum PD at which a loan is still profitable.

    At break-even: revenue = expected_loss
    int_rate * loan * (term/12) = PD * LGD * loan
    → PD_max = int_rate * (term/12) / LGD
    """
    lgd = float(np.clip(lgd, 1e-6, 1.0))
    return (int_rate * (term / 12)) / lgd


def break_even_analysis(df: pd.DataFrame) -> pd.DataFrame:
    """
    For each loan, compute the maximum PD that would still be profitable
    and compare to the actual predicted PD.

    Useful for understanding how much margin each loan has.
    """
    df = df.copy()
    df["lgd_clipped"] = df["lgd"].clip(1e-6, 1.0)
    df["pd_break_even"] = (df["int_rate"] * (df["term"] / 12)) / df["lgd_clipped"]
    df["pd_headroom"]   = df["pd_break_even"] - df["pd"]   # positive = safe margin
    df["profitable"]    = df["pd_headroom"] > 0
    return df[["loan_id", "pd", "pd_break_even", "pd_headroom", "profitable"]]
