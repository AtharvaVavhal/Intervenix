"""
ml/train_lgbm.py — LightGBM training, aligned to preprocess.py feature set.
Monotone constraints reference NUMERIC_COLS + ORDINAL_COLS from preprocess.py.
simulate.py loads models/xgboost_model.joblib — filename unchanged.
"""

from __future__ import annotations

import numpy as np
from lightgbm import LGBMClassifier, early_stopping, log_evaluation
from sklearn.isotonic import IsotonicRegression

MONOTONE_DIRECTIONS: dict[str, int] = {
    "int_rate":          +1,
    "term_months":       +1,
    "int_rate_x_term":   +1,
    "dti":               +1,
    "payment_burden":    +1,
    "loan_to_income":    +1,
    "risk_interaction":  +1,
    "credit_pressure":   +1,
    "revol_util":        +1,
    "revol_util_x_dti":  +1,
    "util_per_account":  +1,
    "debt_per_account":  +1,
    "delinq_2yrs":       +1,
    "delinq_per_year":   +1,
    "has_delinquency":   +1,
    "pub_rec":           +1,
    "has_pub_rec":       +1,
    "inq_last_6mths":    +1,
    "fico_avg":          -1,
    "credit_age_months": -1,
    "annual_inc":        -1,
    "inc_per_inquiry":   -1,
    "emp_length_yrs":    -1,
    "grade":             +1,
    "sub_grade":         +1,
}


def build_monotone_vector(feature_names: list[str]) -> list[int]:
    v = []
    for name in feature_names:
        bare = name.split("__")[-1]
        v.append(MONOTONE_DIRECTIONS.get(bare, 0))
    constrained = sum(c != 0 for c in v)
    print(f"[Monotone] {constrained}/{len(v)} features constrained.")
    return v


def train_lgbm(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray,
    feature_names: list[str] | None = None,
) -> tuple[LGBMClassifier, IsotonicRegression]:
    print(f"[train_lgbm] X_train: {X_train.shape}  |  X_val: {X_val.shape}")
    print(f"[train_lgbm] Default rate — train: {y_train.mean():.3%}  val: {y_val.mean():.3%}")

    monotone = build_monotone_vector(list(feature_names)) if feature_names is not None else None
    if monotone is None:
        print("[train_lgbm] Warning: monotone constraints skipped.")

    model = LGBMClassifier(
        n_estimators=800,
        learning_rate=0.03,
        num_leaves=64,
        max_depth=-1,
        min_child_samples=100,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=1.0,
        reg_lambda=1.0,
        monotone_constraints=monotone,
        random_state=42,
        n_jobs=-1,
        verbose=-1,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        eval_metric="auc",
        callbacks=[
            early_stopping(stopping_rounds=50, verbose=False),
            log_evaluation(period=100),
        ],
    )

    best_iter = model.best_iteration_
    best_auc  = model.best_score_["valid_0"]["auc"]
    print(f"[train_lgbm] Best iteration: {best_iter}  |  Val AUC: {best_auc:.4f}")

    raw_probs  = model.predict_proba(X_val)[:, 1]
    calibrator = IsotonicRegression(out_of_bounds="clip")
    calibrator.fit(raw_probs, y_val)
    print("[train_lgbm] Isotonic calibrator fitted.")

    return model, calibrator


def check_top_slice_quality(
    sim_df,
    pd_col: str = "pd",
    default_col: str = "actual_default",
    top_pct: float = 0.05,
) -> None:
    n    = int(top_pct * len(sim_df))
    top  = sim_df.nsmallest(n, pd_col)
    rate = top[default_col].mean()
    base = sim_df[default_col].mean()
    print(f"\n[Top-slice quality — lowest {top_pct:.0%} PD]")
    print(f"  Actual default rate in slice : {rate:.3%}")
    print(f"  Base default rate (full pool): {base:.3%}")
    print(f"  {'OK: model separates well at top' if rate < base else 'WARN: no improvement over base rate'}")