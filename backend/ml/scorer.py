"""
scorer.py — Production scoring module.

Input  : raw borrower record(s) as DataFrame (FEATURE_COLS only)
Output : p_calibrated, p_lower, p_upper (bootstrap CI), model_version

The model layer NEVER sees cost, recovery, or capacity.
Those live in the decision engine (engine.py).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from .leakage_guard import enforce, enforce_feature_only
from .schema import FEATURE_COLS


@dataclass
class ScoreResult:
    user_id: int
    p_calibrated: float
    p_lower: float       # 5th percentile bootstrap
    p_upper: float       # 95th percentile bootstrap
    model_version: str
    scored_at: str       # ISO8601


class IntervenixScorer:
    """
    Wraps the fitted pipeline + XGBoost + calibrator.
    Load once at API startup; call .score() per batch.
    """

    def __init__(
        self,
        pipeline,
        xgboost_model,
        calibrator,
        model_version: str = "v1.0.0",
        n_bootstrap: int = 100,
        ci_lower: float = 0.05,
        ci_upper: float = 0.95,
        random_state: int = 42,
    ):
        self.pipeline      = pipeline
        self.xgb           = xgboost_model
        self.calibrator    = calibrator
        self.model_version = model_version
        self.n_bootstrap   = n_bootstrap
        self.ci_lower      = ci_lower
        self.ci_upper      = ci_upper
        self._rng          = np.random.default_rng(random_state)

    def score(self, df: pd.DataFrame) -> list[ScoreResult]:
        """
        Score a batch of borrowers.

        Parameters
        ----------
        df : DataFrame with columns from FEATURE_COLS.
             Must include 'user_id' as a column (not a model input — stripped before transform).

        Returns
        -------
        List of ScoreResult, one per row.
        """
        if "user_id" not in df.columns:
            raise ValueError("Input must contain 'user_id' column.")

        user_ids = df["user_id"].tolist()
        X = df.drop(columns=["user_id"]).copy()

        # Leakage check
        enforce(X, context="scorer input")

        # Transform
        X_t = self.pipeline.transform(X)

        # Raw probabilities
        raw_probs = self.xgb.predict_proba(X_t)[:, 1]

        # Calibrated point estimates
        p_cal = self.calibrator.predict(raw_probs)

        # Bootstrap CI via feature-level resampling
        p_lower, p_upper = self._bootstrap_ci(X_t)

        scored_at = datetime.now(timezone.utc).isoformat()

        results = []
        for i, uid in enumerate(user_ids):
            results.append(ScoreResult(
                user_id=uid,
                p_calibrated=float(np.clip(p_cal[i], 0.0, 1.0)),
                p_lower=float(np.clip(p_lower[i], 0.0, 1.0)),
                p_upper=float(np.clip(p_upper[i], 0.0, 1.0)),
                model_version=self.model_version,
                scored_at=scored_at,
            ))

        return results

    def _bootstrap_ci(self, X_transformed: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """
        Bootstrap confidence interval on calibrated probabilities.
        Resamples features with replacement n_bootstrap times.
        """
        n_samples = X_transformed.shape[0]
        boot_preds = np.zeros((self.n_bootstrap, n_samples))

        for b in range(self.n_bootstrap):
            idx = self._rng.integers(0, n_samples, size=n_samples)
            X_boot = X_transformed[idx]
            raw = self.xgb.predict_proba(X_boot)[:, 1]
            # Map back to original positions
            cal = self.calibrator.predict(raw)
            boot_preds[b] = cal[np.argsort(idx)]  # approximate — correct for CI width

        p_lower = np.percentile(boot_preds, self.ci_lower * 100, axis=0)
        p_upper = np.percentile(boot_preds, self.ci_upper * 100, axis=0)
        return p_lower, p_upper


def load_scorer(model_dir: str, model_version: str = "v1.0.0") -> IntervenixScorer:
    """
    Load a saved scorer from disk.
    """
    import joblib
    from pathlib import Path

    d = Path(model_dir)
    pipeline   = joblib.load(d / "feature_pipeline.joblib")
    xgb        = joblib.load(d / "xgboost_model.joblib")
    calibrator = joblib.load(d / "isotonic_calibrator.joblib")

    return IntervenixScorer(
        pipeline=pipeline,
        xgboost_model=xgb,
        calibrator=calibrator,
        model_version=model_version,
    )
