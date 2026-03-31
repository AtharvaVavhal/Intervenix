# =============================================================================
#  simulate.py  —  Steps 7–11
#  Credit Risk + Capital Allocation Simulation
#  Evaluation uses REALIZED profit only. Expected profit is used only for
#  ranking and strategy decisions — never for reported metrics.
# =============================================================================

import numpy as np
import pandas as pd

# =============================================================================
#  STEP 7 — Guard + recompute realized columns
# =============================================================================

_required = ["actual_loss", "actual_revenue", "actual_profit"]
_missing  = [c for c in _required if c not in sim_df.columns]

if _missing:
    print(f"⚠️  Recomputing missing columns: {_missing}")
    sim_df["actual_loss"] = (
        sim_df["actual_default"]
        * sim_df["lgd"]
        * sim_df["loan_amnt"]
    )

# Always recompute actual_revenue with 0.5 haircut.
# Step 6 uses full interest (optimistic). This is the realistic version.
sim_df["actual_revenue"] = (
    (1 - sim_df["actual_default"])
    * 0.5                               # haircut: prepayment + early-default timing
    * sim_df["int_rate"]
    * sim_df["loan_amnt"]
    * (sim_df["term"] / 12)
)
sim_df["actual_profit"] = sim_df["actual_revenue"] - sim_df["actual_loss"]
print("✅ actual_revenue recomputed with 0.5 haircut.")

for col in _required:
    if col not in sim_df.columns:
        raise ValueError(
            f"❌ '{col}' still missing from sim_df after recompute. "
            "Re-run Steps 5–6 before continuing."
        )

print(f"✅ sim_df ready — {len(sim_df):,} rows, columns: {list(sim_df.columns)}")

# =============================================================================
#  CONSTANTS
# =============================================================================

CAPITAL_BUDGET  = 1_000_000_000   # $1 billion
COST_OF_CAPITAL = 0.08            # 8% annual charge on deployed capital

# =============================================================================
#  STEP 8 — evaluate_strategy()
# =============================================================================

def evaluate_strategy(
    sim_df,
    strategy,
    pd_threshold    = 0.20,
    capital_budget  = CAPITAL_BUDGET,
    cost_of_capital = COST_OF_CAPITAL,
):
    """
    Evaluate a lending strategy using REALIZED profit.

    Parameters
    ----------
    sim_df          : Full simulation DataFrame (never mutated).
    strategy        : "approve_all" | "pd_threshold" | "profit_based"
    pd_threshold    : PD cutoff, used only by pd_threshold strategy.
    capital_budget  : Max total loan_amnt to fund (hard constraint).
    cost_of_capital : Annual cost rate on deployed capital.

    Returns
    -------
    dict with realized metrics + approved_df for downstream analysis.
    """

    # Work on a copy — never mutate the caller's DataFrame.
    df = sim_df.copy()

    # ── PD ceiling ────────────────────────────────────────────────────────────
    # np.minimum caps the top only; low PDs are left untouched.
    # np.clip would floor at 0.01, artificially penalising safe borrowers.
    df["pd"] = np.minimum(df["pd"], 0.35)

    # ── Expected metrics (used for ranking only, not for reported results) ────
    # 0.6x haircut on expected_revenue: full interest is never collected because
    # defaults happen early and prepayments shorten duration.
    df["expected_revenue"] = (
        0.6 * df["int_rate"] * df["loan_amnt"] * (df["term"] / 12)
    )
    df["expected_loss"]   = df["pd"] * df["lgd"] * df["loan_amnt"]
    df["expected_profit"] = df["expected_revenue"] - df["expected_loss"]

    # ── Risk-adjusted rank score ──────────────────────────────────────────────
    # score = expected_profit × (1 − pd) / loan_amnt
    # Penalises high-PD loans even when expected_profit looks positive on paper.
    # Normalising by loan_amnt prevents large loans from dominating purely on
    # absolute dollar profit.
    safe_amnt        = df["loan_amnt"].replace(0, np.nan)
    df["rank_score"] = (df["expected_profit"] * (1 - df["pd"])) / safe_amnt
    df["rank_score"] = df["rank_score"].fillna(-np.inf)

    # ── Strategy decision rules ───────────────────────────────────────────────

    if strategy == "approve_all":
        # Baseline: every loan is a candidate; selection is random (no model).
        df["approved"]    = True
        df["conditional"] = False

    elif strategy == "pd_threshold":
        # Naive rule: reject anyone above a fixed PD cutoff.
        df["approved"]    = df["pd"] < pd_threshold
        df["conditional"] = False

    elif strategy == "profit_based":
        # ── CORRECT implementation ────────────────────────────────────────────
        # Do NOT pre-filter df globally — that breaks approval_rate, baseline
        # comparability, and stress-test scaling (same failure mode as TOP_PERCENT).
        #
        # Instead:
        #   1. Mark every loan as approved (full pool enters the capital queue).
        #   2. Mark economically valid loans separately.
        #   3. The candidate selection below uses is_economic as the gate,
        #      keeping len(df) stable for metric denominators.
        df["approved"]    = True
        df["conditional"] = False
        df["is_economic"] = df["expected_profit"] > 0   # economic filter flag

    else:
        raise ValueError(f"Unknown strategy: '{strategy}'")

    # Snapshot conditional count from the full pool BEFORE capital filtering.
    n_conditional = int(df["conditional"].sum()) if "conditional" in df.columns else 0

    # ── Capital constraint — identical logic for all strategies ───────────────
    if strategy == "approve_all":
        # Random ordering = true uninformed baseline. No model signal.
        candidates = df.sample(frac=1, random_state=42).copy()

    elif strategy == "profit_based":
        # Gate on BOTH approved AND is_economic — len(df) stays intact.
        # Sort best-first so cumsum greedily funds the highest-quality loans.
        mask       = df["approved"] & df["is_economic"]
        candidates = (
            df[mask]
            .sort_values("rank_score", ascending=False)
            .copy()
        )

    else:
        # pd_threshold: approved set only, sorted by rank score.
        candidates = (
            df[df["approved"]]
            .sort_values("rank_score", ascending=False)
            .copy()
        )

    # Greedy capital allocation: fund loans in order until budget is exhausted.
    candidates["cumulative_exposure"] = candidates["loan_amnt"].cumsum()
    approved = candidates[candidates["cumulative_exposure"] <= capital_budget].copy()

    # ── Debug print ───────────────────────────────────────────────────────────
    if len(approved) == 0:
        print(f"  ⚠️  [{strategy}] No loans approved — check thresholds or budget.")
        mean_ep = np.nan
    else:
        mean_ep = approved["expected_profit"].mean()
    print(
        f"  [{strategy}] Approved: {len(approved):,}  |  "
        f"Mean expected profit: ${mean_ep:,.2f}"
    )

    # ── Sanity: approval rate warning ─────────────────────────────────────────
    # approval_rate denominator is always len(df) — full pool — so it is
    # comparable across all strategies.
    approval_rate = len(approved) / len(df) if len(df) > 0 else 0
    if approval_rate < 0.05 or approval_rate > 0.95:
        print(f"  ⚠️  [{strategy}] Unusual approval rate: {approval_rate:.1%} — verify config.")

    # ── Realized metrics (ACTUAL data only) ───────────────────────────────────
    # Cost of capital: lender pays cost_of_capital % per year on every dollar
    # deployed. Annualised by term (months → years).
    capital_cost      = cost_of_capital * approved["loan_amnt"] * (approved["term"] / 12)
    total_profit      = (approved["actual_profit"] - capital_cost).sum()
    total_exposure    = approved["loan_amnt"].sum()
    total_actual_loss = approved["actual_loss"].sum()
    default_rate      = approved["actual_default"].mean()
    n_approved        = len(approved)

    roi             = total_profit / total_exposure      if total_exposure > 0 else np.nan
    loss_rate       = total_actual_loss / total_exposure if total_exposure > 0 else np.nan
    profit_per_loan = total_profit / n_approved          if n_approved > 0    else np.nan

    return {
        "total_profit":    total_profit,
        "approval_rate":   approval_rate,
        "default_rate":    default_rate,
        "total_exposure":  total_exposure,
        "roi":             roi,
        "loss_rate":       loss_rate,
        "profit_per_loan": profit_per_loan,
        "n_approved":      n_approved,
        "n_conditional":   n_conditional,
        "approved_df":     approved,
    }

# =============================================================================
#  STEP 9 — Run all strategies
# =============================================================================

strategies = {
    "Baseline (approve all)":    {"strategy": "approve_all"},
    "Naive PD threshold (0.15)": {"strategy": "pd_threshold", "pd_threshold": 0.15},
    "Naive PD threshold (0.20)": {"strategy": "pd_threshold", "pd_threshold": 0.20},
    "Naive PD threshold (0.25)": {"strategy": "pd_threshold", "pd_threshold": 0.25},
    "Profit-Based Model":        {"strategy": "profit_based"},
}

print("\n" + "=" * 60)
print("  STRATEGY COMPARISON — REALIZED PROFIT")
print(f"  Capital Budget: ${CAPITAL_BUDGET:,.0f}")
print("=" * 60)

# ── PD calibration check ──────────────────────────────────────────────────────
# If PD 0.10–0.20 bucket shows 5% actual default → well calibrated.
# If same bucket shows 1% actual default → PD is globally inflated.
print("\n  [ PD Calibration Check ]")
print(
    sim_df
    .groupby(pd.cut(sim_df["pd"], bins=5))["actual_default"]
    .mean()
    .rename("actual_default_rate")
    .to_string()
)
print()

results = {}
for name, kwargs in strategies.items():
    r = evaluate_strategy(sim_df, **kwargs)
    results[name] = r

    print(f"\n{name}:")
    print(f"  Profit:           ${r['total_profit']:>15,.0f}")
    print(f"  Approval Rate:    {r['approval_rate']:.1%}  ({r['n_approved']:,} loans)")
    print(f"  Default Rate:     {r['default_rate']:.1%}")
    print(f"  Total Exposure:   ${r['total_exposure']:>15,.0f}")
    print(f"  ROI:              {r['roi']:.3%}")
    print(f"  Loss Rate:        {r['loss_rate']:.3%}")
    print(f"  Profit per Loan:  ${r['profit_per_loan']:>10,.0f}")

    if name == "Profit-Based Model":
        appr = r["approved_df"]
        print(f"\n  [ Distribution Insight — Profit-Based Model ]")
        for pct in [10, 50, 90]:
            pd_p  = np.percentile(appr["pd"],        pct)
            amt_p = np.percentile(appr["loan_amnt"], pct)
            print(f"    p{pct:>2}  PD: {pd_p:.3f}   Loan Amount: ${amt_p:>10,.0f}")
        print(f"    Conditional (near-miss, excluded): {r['n_conditional']:,} loans")

# =============================================================================
#  STEP 10 — Winners + profit lift
# =============================================================================

winner_profit = max(results, key=lambda k: results[k]["total_profit"])
winner_roi    = max(
    results,
    key=lambda k: results[k]["roi"] if not np.isnan(results[k]["roi"]) else -np.inf
)

print(f"\n{'=' * 60}")
print(f"  🏆 Winner by Highest Profit : {winner_profit}")
print(f"     Profit: ${results[winner_profit]['total_profit']:,.0f}")
print(f"\n  🏆 Winner by Best ROI       : {winner_roi}")
print(f"     ROI:    {results[winner_roi]['roi']:.3%}")
print(f"{'=' * 60}")

baseline_profit = results["Baseline (approve all)"]["total_profit"]
baseline_roi    = results["Baseline (approve all)"]["roi"]

print(f"\n  Profit lift vs Baseline (approve all):")
for name, r in results.items():
    if name == "Baseline (approve all)":
        continue
    lift     = r["total_profit"] - baseline_profit
    pct      = lift / abs(baseline_profit) * 100 if baseline_profit != 0 else 0
    roi_lift = (r["roi"] - baseline_roi) * 100   if not np.isnan(r["roi"]) else np.nan
    print(f"  {name}:")
    print(f"    Profit lift: ${lift:>+,.0f}  ({pct:+.1f}%)")
    print(f"    ROI lift:    {roi_lift:+.2f} pp")

# =============================================================================
#  STEP 11 — Stress test: ROI degradation curve
# =============================================================================
# As budget grows you fund deeper into the pool. ROI should fall because the
# best loans are consumed first.
#   - Fast drop  → thin quality depth, strategy hits ceiling early.
#   - Slow drop  → robust depth, strategy scales well.

_budgets = [0.5e9, 1e9, 2e9, 3e9, 5e9]

print(f"\n{'=' * 60}")
print("  STRESS TEST — ROI DEGRADATION BY CAPITAL BUDGET")
print(f"  (Profit-Based Model vs Baseline, cost of capital = {COST_OF_CAPITAL:.0%})")
print(f"{'=' * 60}")
print(f"  {'Budget':>10}  {'Model ROI':>12}  {'Baseline ROI':>13}  {'Approval Rate':>14}")
print(f"  {'-'*10}  {'-'*12}  {'-'*13}  {'-'*14}")

_model_rois    = []
_baseline_rois = []

for budget in _budgets:
    _m = evaluate_strategy(sim_df, strategy="profit_based",  capital_budget=budget)
    _b = evaluate_strategy(sim_df, strategy="approve_all",   capital_budget=budget)
    _model_rois.append(_m["roi"])
    _baseline_rois.append(_b["roi"])
    print(
        f"  ${budget/1e9:>8.1f}B"
        f"  {_m['roi']:>11.2%}"
        f"  {_b['roi']:>12.2%}"
        f"  {_m['approval_rate']:>13.1%}"
    )

# ── ROI shape diagnosis ───────────────────────────────────────────────────────
_drop = _model_rois[0] - _model_rois[-1]   # ROI at $0.5B minus ROI at $5B
print(f"\n  ROI drop  $0.5B → $5B: {_drop*100:+.1f} pp  (Profit-Based Model)")

if _model_rois[-1] < 0:
    print("  📉 Strategy collapses at scale.")
    print("     Economic filter is exhausting positive-EV pool before budget.")
    print("     → Check PD/LGD calibration; consider relaxing int_rate assumptions.")
elif _drop > 0.10:
    print("  ⚠️  Steep degradation — hits quality ceiling at large budgets.")
    print("     → Model depth is limited. Improve PD discrimination to widen pool.")
else:
    print("  ✅ Gradual degradation — strategy has real depth and scales well.")

print(f"{'=' * 60}")

# =============================================================================
#  SANITY CHECK BLOCK
# =============================================================================

print(f"\n{'=' * 60}")
print("  SANITY CHECK — Profit-Based Model @ $1B")
print(f"{'=' * 60}")

_pb  = results["Profit-Based Model"]
_ap  = _pb["approved_df"]

deployed    = _ap["loan_amnt"].sum()
utilization = deployed / CAPITAL_BUDGET

# Rank score of the worst-ranked loan that was approved.
bottom_score = _ap["rank_score"].min()
top_score    = _ap["rank_score"].max()

# Monotonicity: approved set must be a contiguous top-ranked prefix.
# diff() on the already-sorted approved_df should be <= 0 throughout.
is_monotonic = bool((_ap["rank_score"].diff().dropna() <= 0).all())

print(f"  Loans approved:       {len(_ap):,}")
print(f"  Capital deployed:     ${deployed:,.0f}  ({utilization:.1%} of budget)")
print(f"  Rank score  top:      {top_score:.6f}")
print(f"  Rank score  bottom:   {bottom_score:.6f}")
print(f"  Score monotonic:      {is_monotonic}")

# Verify cutoff: the best excluded loan must score <= the worst approved loan.
# Any violation means a better loan was skipped, which breaks optimality.
_not_approved = sim_df[~sim_df.index.isin(_ap.index)].copy()
_not_approved["pd"]           = np.minimum(_not_approved["pd"], 0.35)
_not_approved["expected_revenue"] = (
    0.6 * _not_approved["int_rate"]
    * _not_approved["loan_amnt"]
    * (_not_approved["term"] / 12)
)
_not_approved["expected_loss"]   = (
    _not_approved["pd"] * _not_approved["lgd"] * _not_approved["loan_amnt"]
)
_not_approved["expected_profit"] = (
    _not_approved["expected_revenue"] - _not_approved["expected_loss"]
)
_economic_excluded = _not_approved[_not_approved["expected_profit"] > 0]

if len(_economic_excluded) > 0:
    safe_amnt = _economic_excluded["loan_amnt"].replace(0, np.nan)
    _economic_excluded = _economic_excluded.copy()
    _economic_excluded["rank_score"] = (
        (_economic_excluded["expected_profit"] * (1 - _economic_excluded["pd"]))
        / safe_amnt
    ).fillna(-np.inf)
    max_excluded_score = _economic_excluded["rank_score"].max()
    cutoff_clean       = bool(bottom_score >= max_excluded_score)
    print(f"  Best excluded score:  {max_excluded_score:.6f}")
    print(f"  Cutoff clean:         {cutoff_clean}")
    if not cutoff_clean:
        print("  ❌ Cutoff violation — a better loan was skipped. Check sorting logic.")
    else:
        print("  ✅ Cutoff correct — approved set is the optimal top-ranked prefix.")
else:
    print("  ✅ All economic loans fit within budget — no exclusions to check.")

# Capital utilization warning.
if utilization < 0.90:
    print(
        f"\n  ⚠️  Low capital utilisation ({utilization:.1%}). "
        "Positive-EV pool may be smaller than budget. "
        "Verify PD/LGD calibration or reduce haircut assumptions."
    )
else:
    print(f"\n  ✅ Capital utilisation healthy ({utilization:.1%}).")

print(f"{'=' * 60}")