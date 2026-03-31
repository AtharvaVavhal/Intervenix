from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd
import xgboost  # required for loading model
import ml  # ensure ml package is registered
from pathlib import Path

app = FastAPI()

# Request schema for prediction
class PredictionRequest(BaseModel):
    data: dict

# Load artifacts once at startup
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"

pipeline   = joblib.load(MODEL_DIR / "feature_pipeline.joblib")
model      = joblib.load(MODEL_DIR / "xgboost_model.joblib")
calibrator = joblib.load(MODEL_DIR / "isotonic_calibrator.joblib")


@app.get("/")
def root():
    return {"message": "API is running"}


@app.post("/predict")
def predict(request: PredictionRequest):
    try:
        df = pd.DataFrame([request.data])

        # --- Feature engineering (must match training) ---
        # installment_to_income
        if "installment" in df.columns and "annual_inc" in df.columns:
            df["installment_to_income"] = df["installment"] / df["annual_inc"]

        # credit_age_years from dates like "Jan-2010"
        if "issue_d" in df.columns and "earliest_cr_line" in df.columns:
            try:
                issue = pd.to_datetime(df["issue_d"], format="%b-%Y", errors="coerce")
                earliest = pd.to_datetime(df["earliest_cr_line"], format="%b-%Y", errors="coerce")
                df["credit_age_years"] = (issue - earliest).dt.days / 365.25
            except Exception:
                df["credit_age_years"] = None

        # DEBUG: ensure correct columns
        if hasattr(pipeline, "feature_names_in_"):
            missing_cols = set(pipeline.feature_names_in_) - set(df.columns)
            if missing_cols:
                return {
                    "error": f"Missing columns: {list(missing_cols)}",
                    "expected_columns": list(pipeline.feature_names_in_)
                }

        X = pipeline.transform(df)
        raw_prob = model.predict_proba(X)[:, 1]
        pd_final = calibrator.predict(raw_prob)

        return {
            "pd": float(pd_final[0])
        }

    except Exception as e:
        import traceback
        return {
            "error": str(e),
            "trace": traceback.format_exc()
        }