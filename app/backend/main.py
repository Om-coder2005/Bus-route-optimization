from __future__ import annotations

from datetime import datetime
from pathlib import Path
import json
import sys

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services.data_service import load_features, load_routes


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from src.optimization.run_optimization import run_scenario

METRICS_PATH = ROOT / "artifacts/metrics/validation_results.json"
MODEL_PATH = ROOT / "artifacts/models/xgboost_demand_model.json"
MAPS_DIR = ROOT / "artifacts/maps"
SCENARIO_INDEX_PATH = ROOT / "artifacts/reports/scenario_index.json"
PREDICTIONS_PATH = ROOT / "artifacts/reports/forecast_predictions.csv"

# Load XGBoost model globally for inference
import xgboost as xgb
_MODEL = None
if MODEL_PATH.exists():
    _MODEL = xgb.XGBRegressor()
    _MODEL.load_model(str(MODEL_PATH))

app = FastAPI(title="Dubai Bus Optimization API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": "0.1.0", "timestamp": datetime.utcnow().isoformat()}


@app.get("/routes")
def routes(route_type: str | None = Query(default=None, alias="type")) -> list[dict]:
    df = load_routes()
    if route_type:
        df = df[df["Route_Type"].str.lower() == route_type.lower()]
    return df.to_dict(orient="records")


@app.get("/network/overview")
def network_overview() -> dict:
    df = load_features()
    latest_date = df["Date"].max()
    latest = df[df["Date"] == latest_date].copy()
    latest["overload_pct"] = ((latest["Total_Pax"] - latest["rolling_7_mean"]) / latest["rolling_7_mean"]).replace(
        [float("inf"), float("-inf")], 0
    )
    latest["overload_pct"] = latest["overload_pct"].fillna(0) * 100
    overloaded = latest[latest["overload_pct"] > 10]
    top_overloaded = (
        latest.sort_values("overload_pct", ascending=False)[["Route_ID", "Route_Code", "overload_pct"]]
        .head(3)
        .to_dict(orient="records")
    )
    return {
        "as_of_date": str(latest_date.date()),
        "total_active_routes": int(latest["Route_ID"].nunique()),
        "overloaded_routes": int(overloaded["Route_ID"].nunique()),
        "overloaded_pct": float((overloaded["Route_ID"].nunique() / max(latest["Route_ID"].nunique(), 1)) * 100),
        "top_overloaded_routes": top_overloaded,
    }


@app.get("/features/importance")
def feature_importance() -> dict:
    if not METRICS_PATH.exists():
        raise HTTPException(status_code=404, detail="Metrics file not found. Train models first.")
    with open(METRICS_PATH, "r", encoding="utf-8") as f:
        payload = json.load(f)
    return payload


@app.get("/network/map")
def network_map(overload: bool = Query(default=True)) -> dict:
    routes_file = MAPS_DIR / "routes.geojson"
    if not routes_file.exists():
        raise HTTPException(status_code=404, detail="routes.geojson not found. Build geojson first.")
    payload = json.loads(routes_file.read_text(encoding="utf-8"))
    if not overload:
        for feat in payload.get("features", []):
            feat.get("properties", {}).pop("overload_pct", None)
    return payload


@app.get("/network/map/stops")
def network_map_stops() -> dict:
    stops_file = MAPS_DIR / "stops.geojson"
    if not stops_file.exists():
        raise HTTPException(status_code=404, detail="stops.geojson not found. Build geojson first.")
    return json.loads(stops_file.read_text(encoding="utf-8"))


# ── Forecast endpoints ────────────────────────────────────────────────────────

@app.get("/routes/{route_id}/forecast")
def route_forecast(
    route_id: int,
    split: str = Query(default="all", description="all | pre_shock_validation | shock_q3 | out_of_time_q4"),
) -> dict:
    """Return actual vs predicted time-series for a single route across all evaluation splits."""
    import pandas as pd

    if not PREDICTIONS_PATH.exists():
        raise HTTPException(status_code=404, detail="forecast_predictions.csv not found. Run train_forecast_models.py first.")

    df = pd.read_csv(PREDICTIONS_PATH, parse_dates=["Date"])
    df = df[df["Route_ID"] == route_id]
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No forecast data for Route_ID={route_id}")

    if split != "all":
        df = df[df["split"] == split]

    df = df.sort_values("Date")

    # Per-split MAPE for this route
    import numpy as np

    def _mape(actual, pred):
        eps = 1e-6
        return float(np.mean(np.abs((actual - pred) / np.maximum(np.abs(actual), eps))) * 100)

    split_metrics: dict[str, dict] = {}
    for sp, grp in df.groupby("split"):
        actual = grp["Total_Pax"].values
        split_metrics[str(sp)] = {
            "naive": _mape(actual, grp["pred_naive_lag_1"].values),
            "ridge": _mape(actual, grp["pred_ridge"].values),
            "xgboost": _mape(actual, grp["pred_xgboost"].values),
        }

    series = df[["Date", "Total_Pax", "pred_naive_lag_1", "pred_ridge", "pred_xgboost", "split"]].copy()
    series["Date"] = series["Date"].dt.strftime("%Y-%m-%d")

    return {
        "route_id": route_id,
        "split_filter": split,
        "split_metrics": split_metrics,
        "series": series.to_dict(orient="records"),
    }


@app.get("/analytics/metrics")
def analytics_metrics() -> dict:
    """Return model validation metrics aggregated across all routes and all splits."""
    if not METRICS_PATH.exists():
        raise HTTPException(status_code=404, detail="Metrics not found. Train models first.")
    with open(METRICS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/analytics/eda")
def analytics_eda(
    metric: str = Query(
        default="growth",
        description="growth | route_type | congestion",
    )
) -> dict:
    """Return chart-ready EDA data for the Forecast Lab analytics panel."""
    import pandas as pd

    df = load_features()

    if metric == "growth":
        # Monthly total pax across all routes
        monthly = (
            df.groupby(df["Date"].dt.to_period("M"))["Total_Pax"]
            .sum()
            .reset_index()
        )
        monthly["Date"] = monthly["Date"].dt.to_timestamp().dt.strftime("%Y-%m")
        return {
            "metric": "growth",
            "label": "Monthly Network Demand (Total Pax)",
            "series": monthly.rename(columns={"Total_Pax": "value"}).to_dict(orient="records"),
        }

    if metric == "route_type":
        # Average daily pax per route type
        rt = (
            df.groupby("Route_Type")["Total_Pax"]
            .mean()
            .reset_index()
            .rename(columns={"Total_Pax": "avg_daily_pax"})
        )
        return {
            "metric": "route_type",
            "label": "Avg Daily Pax by Route Type",
            "series": rt.to_dict(orient="records"),
        }

    if metric == "congestion":
        # Congestion level vs total pax — sample 2000 points to avoid oversized payload
        sample = df[["Congestion_Level", "Total_Pax", "Route_Type"]].dropna()
        if len(sample) > 2000:
            sample = sample.sample(2000, random_state=42)
        return {
            "metric": "congestion",
            "label": "Congestion Level vs Total Pax",
            "series": sample.to_dict(orient="records"),
        }

    raise HTTPException(status_code=400, detail=f"Unknown metric: {metric}. Use growth|route_type|congestion")


@app.get("/forecast/predict")
def forecast_predict(
    route_id: int,
    horizon: int = Query(default=7, description="7 | 30 | 90 | 180 days"),
) -> dict:
    """Generate future demand projection for a route up to 6 months."""
    import pandas as pd
    import numpy as np

    if _MODEL is None:
        raise HTTPException(status_code=503, detail="Model not initialized.")

    df = load_features()
    route_df = df[df["Route_ID"] == route_id].sort_values("Date")
    if route_df.empty:
        raise HTTPException(status_code=404, detail=f"Route {route_id} not found.")

    latest = route_df.iloc[-1].to_dict()
    start_date = latest["Date"]
    
    # Feature columns used during training (must match src/models/train_forecast_models.py)
    feature_cols = [
        "lag_1", "lag_7", "rolling_7_mean", "Congestion_Level", "Avg_Speed_kmph",
        "day_of_week", "month", "quarter", "is_weekend", "is_shock_regime", "stop_count"
    ]

    future_series = []
    current_pax = latest["Total_Pax"]
    history = route_df["Total_Pax"].tolist()[-30:] # last 30 days for rolling mean

    for i in range(1, horizon + 1):
        target_date = start_date + pd.Timedelta(days=i)
        
        # Build features for this future date
        row = {
            "lag_1": current_pax,
            "lag_7": history[-7] if len(history) >= 7 else current_pax,
            "rolling_7_mean": np.mean(history[-7:]) if len(history) >= 7 else current_pax,
            "Congestion_Level": latest["Congestion_Level"], # assume persistence
            "Avg_Speed_kmph": latest["Avg_Speed_kmph"],
            "day_of_week": target_date.dayofweek,
            "month": target_date.month,
            "quarter": (target_date.month - 1) // 3 + 1,
            "is_weekend": 1 if target_date.dayofweek >= 5 else 0,
            "is_shock_regime": 1, # assuming we stay in shock regime for 2026
            "stop_count": latest["stop_count"]
        }
        
        # Prepare for XGBoost
        X = np.array([[row[c] for c in feature_cols]])
        pred_pax = float(_MODEL.predict(X)[0])
        
        # Update history for next iteration
        current_pax = pred_pax
        history.append(pred_pax)
        
        future_series.append({
            "Date": target_date.strftime("%Y-%m-%d"),
            "Total_Pax": pred_pax,
            "is_future": True
        })

    return {
        "route_id": route_id,
        "horizon": horizon,
        "series": future_series
    }


@app.post("/models/retrain")
def models_retrain() -> dict:
    """Simulate the 6-month model retraining cycle."""
    import subprocess
    import os

    # Run the training script in the background
    try:
        # Using sys.executable to ensure we use the same python environment
        subprocess.Popen([sys.executable, str(ROOT / "src/models/train_forecast_models.py")], 
                         cwd=str(ROOT),
                         env=os.environ.copy())
        return {
            "status": "initiated", 
            "message": "Model retraining started. Dashboard will refresh with updated intelligence upon completion.",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Optimization endpoints ────────────────────────────────────────────────────

@app.get("/optimization/scenarios")
def optimization_scenarios() -> dict:
    if not SCENARIO_INDEX_PATH.exists():
        return {"scenarios": []}
    return {"scenarios": json.loads(SCENARIO_INDEX_PATH.read_text(encoding="utf-8"))}


class ScenarioRequest(BaseModel):
    budget: int
    congestion_multiplier: float = 1.0


@app.post("/optimization/run")
def optimization_run(payload: ScenarioRequest) -> dict:
    if payload.budget not in {0, 30, 60, 90}:
        raise HTTPException(status_code=400, detail="budget must be one of 0, 30, 60, 90")
    return run_scenario(budget=payload.budget, congestion_multiplier=payload.congestion_multiplier)


@app.get("/recommendations")
def recommendations(
    budget: int = Query(default=60),
    congestion_multiplier: float = Query(default=1.0),
) -> dict:
    scenario = run_scenario(budget=budget, congestion_multiplier=congestion_multiplier)
    return {
        "scenario_id": scenario["scenario_id"],
        "budget": scenario["budget"],
        "top_recommendations": scenario["top_recommendations"],
        "routes_stabilized": scenario["routes_stabilized"],
    }


@app.get("/optimization/export/{scenario_id}")
def optimization_export(scenario_id: str):
    """Serve the generated scenario CSV as a downloadable file."""
    # Security: check if ID follows expected pattern to prevent path traversal
    if not scenario_id.startswith("scenario_"):
        raise HTTPException(status_code=400, detail="Invalid scenario ID")

    path = ROOT / "artifacts/reports/scenarios" / f"{scenario_id}.csv"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Scenario file not found. Run optimization first.")

    return FileResponse(
        path,
        media_type="text/csv",
        filename=f"Dubai_Bus_Optimization_{scenario_id}.csv"
    )

