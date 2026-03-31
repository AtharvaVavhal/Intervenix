"""
train.py — Train XGBoost PD model with isotonic calibration.

Three-way split:
  60% train  -> fit XGBoost
  20% cal    -> fit isotonic calibration
  20% test   -> final evaluation (touch once)

Outputs:
  - Fitted pipeline (feature engineer + preprocessor + XGBoost)
  - Fitted calibrator (IsotonicRegression)
  - Evaluation metrics dict
"""
from __future__ import annotations

print("FILE STARTED", flush=True)

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

from .leakage_guard import enforce, drop_disallowed
from .preprocess import build_full_pipeline, build_target, compute_lgd
from .schema import FEATURE_COLS, LGD_COLS, TARGET_COL


# ── Hyperparameters (from blueprint) ────────────────────────────────────────

XGBOOST_PARAMS: dict[str, Any] = {
    "n_estimators": 300,
    "max_depth": 4,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "eval_metric": "aucpr",
    "early_stopping_rounds": 20,
    "random_state": 42,
    "n_jobs": -1,
    "tree_method": "hist",
}


# ── ECE computation ─────────────────────────────────────────────────────────

def expected_calibration_error(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10) -> float:
    """
    Expected Calibration Error.
    Blueprint threshold: ECE < 0.05 for production deployment.
    """
    fraction_of_positives, mean_predicted = calibration_curve(
        y_true, y_prob, n_bins=n_bins, strategy="uniform"
    )
    bin_sizes = np.histogram(y_prob, bins=n_bins, range=(0, 1))[0]
    weights = bin_sizes[bin_sizes > 0] / len(y_true)
    ece = float(np.sum(weights * np.abs(fraction_of_positives - mean_predicted)))
    return ece


# ── PSI computation ─────────────────────────────────────────────────────────

def population_stability_index(
    expected: np.ndarray, actual: np.ndarray, n_bins: int = 10
) -> float:
    """
    PSI between two score distributions.
    Blueprint threshold: PSI < 0.25 for scoring to remain active.
    """
    bins = np.linspace(0, 1, n_bins + 1)
    e_counts, _ = np.histogram(expected, bins=bins)
    a_counts, _ = np.histogram(actual, bins=bins)

    e_pct = (e_counts + 1e-6) / len(expected)
    a_pct = (a_counts + 1e-6) / len(actual)

    psi = float(np.sum((a_pct - e_pct) * np.log(a_pct / e_pct)))
    return psi


# ── JSON-safe serializer ─────────────────────────────────────────────────────

def _json_safe(obj):
    """Convert numpy/bool types to Python natives for json.dump."""
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


# ── Main training function ──────────────────────────────────────────────────

def train(
    df_raw: pd.DataFrame,
    model_dir: Path | None = None,
    model_version: str = "v1.0.0",
) -> dict[str, Any]:
    """
    Full training run. Returns dict with model, calibrator, and metrics.

    Parameters
    ----------
    df_raw        : Raw Lending Club DataFrame (any columns allowed here;
                    we enforce schema inside).
    model_dir     : If provided, saves artifacts here.
    model_version : Semantic version string for MLflow / registry.
    """

    print(f"\n{'='*60}")
    print(f"  INTERVENIX MODEL TRAINING — {model_version}")
    print(f"{'='*60}\n")

    # ── Step 1: Remove known leakage columns BEFORE enforcement ───────────
    leakage_cols = [
        'total_pymnt','total_pymnt_inv','total_rec_int','total_rec_late_fee','total_rec_prncp',
        'recoveries','collection_recovery_fee','last_pymnt_d','last_pymnt_amnt','next_pymnt_d',
        'last_credit_pull_d','out_prncp','out_prncp_inv','mths_since_last_delinq',
        'mths_since_last_record','mths_since_last_major_derog'
    ]

    df_raw = df_raw.drop(columns=[c for c in leakage_cols if c in df_raw.columns])

    enforce(df_raw, context="cleaned input")
    print("[1/7] Leakage columns removed + guard passed.")

    # ── Step 2: Build target, filter to closed loans ───────────────────────
    kept_idx, y_all = build_target(df_raw)
    df_all = df_raw.loc[kept_idx].copy()

    # Save LGD inputs before dropping (only used outside model pipeline)
    lgd_cols_present = [c for c in LGD_COLS if c in df_all.columns]
    df_lgd = df_all[lgd_cols_present + ["funded_amnt"]].copy() if lgd_cols_present else None

    # ── Step 3: Strict column drop ─────────────────────────────────────────
    df_X = drop_disallowed(df_all)
    print(f"[3/7] Features retained: {len(df_X.columns)} columns.")

    # ── Step 4: Three-way split ────────────────────────────────────────────
    X_trainval, X_test, y_trainval, y_test = train_test_split(
        df_X, y_all, test_size=0.20, random_state=42, stratify=y_all
    )
    X_train, X_cal, y_train, y_cal = train_test_split(
        X_trainval, y_trainval, test_size=0.25, random_state=42, stratify=y_trainval
    )
    # 0.25 of 0.80 = 0.20 of total → gives 60/20/20 split

    print(
        f"[4/7] Split: train={len(X_train):,}  cal={len(X_cal):,}  test={len(X_test):,}"
    )

    # Scale pos weight for class imbalance
    neg = (y_train == 0).sum()
    pos = (y_train == 1).sum()
    scale_pos_weight = neg / pos
    print(f"      Default rate: {pos / len(y_train):.1%}  scale_pos_weight={scale_pos_weight:.1f}")

    # ── Step 5: Build pipeline + fit XGBoost ──────────────────────────────
    pipeline = build_full_pipeline()

    X_train_t = pipeline.fit_transform(X_train)
    X_cal_t   = pipeline.transform(X_cal)
    X_test_t  = pipeline.transform(X_test)

    xgb = XGBClassifier(
        **{**XGBOOST_PARAMS, "scale_pos_weight": scale_pos_weight}
    )
    xgb.fit(
        X_train_t, y_train,
        eval_set=[(X_cal_t, y_cal)],
        verbose=False,
    )

    # Guard: best_iteration can be None if early stopping never triggered
    best_iter = xgb.best_iteration if xgb.best_iteration is not None else xgb.n_estimators
    print(f"[5/7] XGBoost trained. Best iteration: {best_iter}")

    # Raw probabilities (uncalibrated)
    raw_cal  = xgb.predict_proba(X_cal_t)[:, 1]
    raw_test = xgb.predict_proba(X_test_t)[:, 1]

    # ── Step 6: Isotonic calibration ─────────────────────────────────────
    calibrator = IsotonicRegression(out_of_bounds="clip")
    calibrator.fit(raw_cal, y_cal)

    p_cal_test = calibrator.predict(raw_test)

    print("[6/7] Isotonic calibration fitted on held-out calibration set.")

    # ── Step 7: Evaluation ────────────────────────────────────────────────
    auc_raw  = roc_auc_score(y_test, raw_test)
    auc_cal  = roc_auc_score(y_test, p_cal_test)
    auprc    = average_precision_score(y_test, p_cal_test)
    brier    = brier_score_loss(y_test, p_cal_test)
    ece_raw  = expected_calibration_error(y_test.values, raw_test)
    ece_cal  = expected_calibration_error(y_test.values, p_cal_test)

    # ── Blueprint gates (all values explicitly cast to Python bool) ────────
    gates = {
        "auc_above_0.80":              bool(auc_cal >= 0.80),
        "ece_below_0.05":              bool(ece_cal < 0.05),
        "auc_preserved_within_0.01":   bool(abs(auc_cal - auc_raw) <= 0.01),
        "brier_improved":              bool(brier < brier_score_loss(y_test, raw_test)),
    }
    all_gates_pass = bool(all(gates.values()))

    metrics = {
        "model_version":            model_version,
        "n_train":                  int(len(X_train)),
        "n_cal":                    int(len(X_cal)),
        "n_test":                   int(len(X_test)),
        "default_rate":             float(pos / len(y_train)),
        "scale_pos_weight":         float(scale_pos_weight),
        "best_iteration":           int(best_iter),
        "auc_raw":                  round(float(auc_raw), 4),
        "auc_calibrated":           round(float(auc_cal), 4),
        "auprc":                    round(float(auprc), 4),
        "brier_score":              round(float(brier), 4),
        "ece_before_calibration":   round(float(ece_raw), 4),
        "ece_after_calibration":    round(float(ece_cal), 4),
        "auc_delta":                round(float(auc_cal - auc_raw), 4),
        "psi_cal_vs_test":          round(float(population_stability_index(raw_cal, raw_test)), 4),
        "production_gates":         gates,
        "production_ready":         all_gates_pass,
    }

    print("\n[7/7] Evaluation Results:")
    print(f"  AUC (raw)         : {auc_raw:.4f}")
    print(f"  AUC (calibrated)  : {auc_cal:.4f}")
    print(f"  AUPRC             : {auprc:.4f}")
    print(f"  Brier Score       : {brier:.4f}")
    print(f"  ECE (before cal)  : {ece_raw:.4f}")
    print(f"  ECE (after cal)   : {ece_cal:.4f}")
    print(f"\n  Production Gates  : {'✅ ALL PASS' if all_gates_pass else '❌ FAILURES'}")
    for gate, passed in gates.items():
        print(f"    {'✅' if passed else '❌'} {gate}")

    # ── Save artifacts ─────────────────────────────────────────────────────
    if model_dir is not None:
        model_dir = Path(model_dir)
        model_dir.mkdir(parents=True, exist_ok=True)

        import joblib
        joblib.dump(pipeline,   model_dir / "feature_pipeline.joblib")
        joblib.dump(xgb,        model_dir / "xgboost_model.joblib")
        joblib.dump(calibrator, model_dir / "isotonic_calibrator.joblib")

        with open(model_dir / "metrics.json", "w") as f:
            json.dump(metrics, f, indent=2, default=_json_safe)

        print(f"\n  Artifacts saved to: {model_dir}")

    return {
        "pipeline":   pipeline,
        "xgboost":    xgb,
        "calibrator": calibrator,
        "metrics":    metrics,
        "splits": {
            "X_train": X_train, "y_train": y_train,
            "X_cal":   X_cal,   "y_cal":   y_cal,
            "X_test":  X_test,  "y_test":  y_test,
        }
    }


# ── CLI ENTRYPOINT ────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    print("MAIN BLOCK RUNNING", flush=True)

    if len(sys.argv) < 2:
        print("Usage: python -m ml.train <csv_path>")
        sys.exit(1)

    csv_path = sys.argv[1]

    print(f"Loading dataset: {csv_path}", flush=True)

    df = pd.read_csv(csv_path, low_memory=False)

    print(f"Dataset loaded: {len(df):,} rows", flush=True)

    train(
        df_raw=df,
        model_dir=Path("models"),
        model_version="v1.0.0",
    )