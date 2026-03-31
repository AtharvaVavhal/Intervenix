# ── INTEGRATION GUIDE ────────────────────────────────────────────────────────
# Drop-in order: features → train → lgd → simulate (no changes to engine)
# ─────────────────────────────────────────────────────────────────────────────


# ════════════════════════════════════════════════════════════════
# STEP A — Feature engineering (in your preprocessing / scoring cell)
# ════════════════════════════════════════════════════════════════

from ml.features import add_engineered_features, ENGINEERED_COLS

# Add to schema so pipeline picks them up
# In ml/schema.py, extend FEATURE_COLS:
#   FEATURE_COLS = FEATURE_COLS + ENGINEERED_COLS

# Then in your training/scoring cell, BEFORE pipeline.transform():
X_features = add_engineered_features(X_features)
X_t        = pipeline.transform(X_features)


# ════════════════════════════════════════════════════════════════
# STEP B — Training (replace XGBoost block in train.py)
# ════════════════════════════════════════════════════════════════

from ml.train_lgbm import train_lgbm, check_top_slice_quality

# Get feature names AFTER fitting the pipeline (needed for monotone constraints)
feature_names = pipeline.get_feature_names_out()   # sklearn ≥ 1.0

model, calibrator = train_lgbm(
    X_train, y_train,
    X_val,   y_val,
    feature_names=feature_names,   # pass None to skip monotone constraints
)

# Save with same filenames so simulate.py loads without changes
import joblib
joblib.dump(model,      "models/xgboost_model.joblib")   # intentionally same name
joblib.dump(calibrator, "models/isotonic_calibrator.joblib")


# ════════════════════════════════════════════════════════════════
# STEP C — Scoring (in simulate.py, Step 2)
# ════════════════════════════════════════════════════════════════

# No changes needed — model and calibrator load identically.
# pipeline.transform() now receives engineered features automatically
# because add_engineered_features() was called before transform().


# ════════════════════════════════════════════════════════════════
# STEP D — LGD segmentation (in simulate.py, Step 3)
# ════════════════════════════════════════════════════════════════

from ml.lgd import compute_lgd_segmented, lgd_segment_summary

# Replace:
#   lgd_scores = compute_lgd(df_closed).values
# With:
lgd_scores = compute_lgd_segmented(df_closed).values

# Optional: print segment breakdown before running strategies
print(lgd_segment_summary(df_closed))


# ════════════════════════════════════════════════════════════════
# STEP E — Quality check (run BEFORE stress test, AFTER sim_df built)
# ════════════════════════════════════════════════════════════════

from ml.train_lgbm import check_top_slice_quality

# This is your real success metric — not AUC.
# Goal: actual default rate in lowest-PD 5% slice should DROP vs old model.
check_top_slice_quality(sim_df, pd_col="pd", default_col="actual_default", top_pct=0.05)

# Then run Step 7–11 unchanged. Compare stress test ROI curve to baseline.


# ════════════════════════════════════════════════════════════════
# EXPECTED CHANGES IN OUTPUT
# ════════════════════════════════════════════════════════════════

# check_top_slice_quality:
#   Before: actual default rate in top-5% ≈ base rate (model not discriminating at top)
#   After:  actual default rate in top-5% materially lower → top slice is cleaner

# Stress test:
#   Before: 9.4% → 3.4% → flat (capacity ceiling)
#   Target: 9%+ → 5%+ → 4%+ → gradual decay (deeper profitable pool)

# If ROI does NOT improve after all three changes:
#   → LGD segmentation had no effect: check if "recoveries" column is populated
#   → Feature engineering had no effect: check if new cols pass through pipeline
#   → Monotone constraints hurt: rerun without them (pass feature_names=None)
