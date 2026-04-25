from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error

try:
    from xgboost import XGBRegressor
except ImportError:  # pragma: no cover
    XGBRegressor = None


ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data/processed/route_day_features.csv"
METRICS_PATH = ROOT / "artifacts/metrics/validation_results.json"
MODEL_PATH = ROOT / "artifacts/models/xgboost_demand_model.json"
PREDICTIONS_PATH = ROOT / "artifacts/reports/forecast_predictions.csv"


def mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    eps = 1e-6
    return float(np.mean(np.abs((y_true - y_pred) / np.maximum(np.abs(y_true), eps))) * 100.0)


def evaluate(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    return {
        "MAPE": mape(y_true, y_pred),
        "MAE": float(mean_absolute_error(y_true, y_pred)),
        "RMSE": float(np.sqrt(mean_squared_error(y_true, y_pred))),
    }


def main() -> None:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Missing dataset: {DATA_PATH}")

    df = pd.read_csv(DATA_PATH, parse_dates=["Date"])
    df = df.sort_values(["Route_ID", "Date"]).reset_index(drop=True)

    # Keep rows where lag features exist.
    df = df.dropna(subset=["lag_1", "lag_7", "rolling_7_mean"]).copy()

    train_end = pd.Timestamp("2025-03-31")
    val_start = pd.Timestamp("2025-04-01")
    val_end = pd.Timestamp("2025-06-30")
    shock_start = pd.Timestamp("2025-07-01")
    shock_end = pd.Timestamp("2025-09-30")
    oot_start = pd.Timestamp("2025-10-01")
    oot_end = pd.Timestamp("2025-12-31")

    train_df = df[df["Date"] <= train_end].copy()
    val_df = df[(df["Date"] >= val_start) & (df["Date"] <= val_end)].copy()
    shock_df = df[(df["Date"] >= shock_start) & (df["Date"] <= shock_end)].copy()
    oot_df = df[(df["Date"] >= oot_start) & (df["Date"] <= oot_end)].copy()

    feature_cols = [
        "lag_1",
        "lag_7",
        "rolling_7_mean",
        "Congestion_Level",
        "Avg_Speed_kmph",
        "day_of_week",
        "month",
        "quarter",
        "is_weekend",
        "is_shock_regime",
        "stop_count",
    ]
    feature_cols = [c for c in feature_cols if c in df.columns]

    X_train = train_df[feature_cols].values
    y_train = train_df["Total_Pax"].values

    # Baseline 1: naive lag_1
    preds = {
        "naive_lag_1": {
            "val": val_df["lag_1"].values,
            "shock": shock_df["lag_1"].values,
            "oot": oot_df["lag_1"].values,
        }
    }

    # Baseline 2: linear (Ridge)
    lin = Ridge(alpha=1.0)
    lin.fit(X_train, y_train)
    preds["ridge"] = {
        "val": lin.predict(val_df[feature_cols].values),
        "shock": lin.predict(shock_df[feature_cols].values),
        "oot": lin.predict(oot_df[feature_cols].values),
    }

    # Primary: XGBoost if available
    if XGBRegressor is not None:
        xgb = XGBRegressor(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=42,
            objective="reg:squarederror",
        )
        xgb.fit(X_train, y_train)
        preds["xgboost"] = {
            "val": xgb.predict(val_df[feature_cols].values),
            "shock": xgb.predict(shock_df[feature_cols].values),
            "oot": xgb.predict(oot_df[feature_cols].values),
        }

    metrics = {"splits": {}, "feature_columns": feature_cols}
    for model_name, split_preds in preds.items():
        metrics["splits"][model_name] = {
            "pre_shock_validation": evaluate(val_df["Total_Pax"].values, split_preds["val"]),
            "shock_q3": evaluate(shock_df["Total_Pax"].values, split_preds["shock"]),
            "out_of_time_q4": evaluate(oot_df["Total_Pax"].values, split_preds["oot"]),
        }

    # Extract feature importance from XGBoost for explainability
    if XGBRegressor is not None and "xgboost" in preds:
        importances = xgb.feature_importances_
        feat_imp = [
            {"feature": col, "importance": float(imp)}
            for col, imp in zip(feature_cols, importances)
        ]
        # Sort by importance descending
        feat_imp = sorted(feat_imp, key=lambda x: x["importance"], reverse=True)
        metrics["importance"] = feat_imp

    METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
    METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    # Save model for real-time inference
    if XGBRegressor is not None and "xgboost" in preds:
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        xgb.save_model(str(MODEL_PATH))
        print(f"Saved model: {MODEL_PATH}")

    # Save prediction table for dashboard/API consumption.
    out_frames = []
    for split_name, split_df in [
        ("pre_shock_validation", val_df),
        ("shock_q3", shock_df),
        ("out_of_time_q4", oot_df),
    ]:
        part = split_df[["Route_ID", "Date", "Total_Pax"]].copy()
        part["split"] = split_name
        for model_name, split_preds in preds.items():
            key = "val" if split_name == "pre_shock_validation" else "shock" if split_name == "shock_q3" else "oot"
            part[f"pred_{model_name}"] = split_preds[key]
        out_frames.append(part)
    pred_df = pd.concat(out_frames, ignore_index=True)
    PREDICTIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    pred_df.to_csv(PREDICTIONS_PATH, index=False)

    print(f"Saved metrics: {METRICS_PATH}")
    print(f"Saved predictions: {PREDICTIONS_PATH}")


if __name__ == "__main__":
    main()
