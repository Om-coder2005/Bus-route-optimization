from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
FEATURES_PATH = ROOT / "data/processed/route_day_features.csv"
OUT_DIR = ROOT / "artifacts/reports/scenarios"


def _compute_overload(df: pd.DataFrame, congestion_multiplier: float = 1.0) -> pd.DataFrame:
    work = df.copy()
    # Baseline capacity proxy from rolling mean, adjusted by congestion multiplier.
    work["baseline_capacity"] = (work["rolling_7_mean"].fillna(work["Total_Pax"]) / congestion_multiplier).clip(lower=1.0)
    work["overload_pct"] = (
        ((work["Total_Pax"] - work["baseline_capacity"]) / work["baseline_capacity"])
        .clip(lower=0)
        * 100
    )
    return work


def _greedy_allocate(df: pd.DataFrame, budget: int, relief_per_bus_pct: float = 1.5) -> pd.DataFrame:
    alloc = df[["Route_ID", "Route_Code", "Route_Type", "Total_Pax", "baseline_capacity", "overload_pct"]].copy()
    alloc["additional_units"] = 0

    for _ in range(int(budget)):
        idx = alloc["overload_pct"].idxmax()
        if alloc.loc[idx, "overload_pct"] <= 0:
            break
        alloc.loc[idx, "additional_units"] += 1
        alloc.loc[idx, "overload_pct"] = max(0.0, float(alloc.loc[idx, "overload_pct"] - relief_per_bus_pct))

    alloc = alloc.rename(columns={"overload_pct": "overload_after_pct"})
    return alloc


def run_scenario(budget: int, congestion_multiplier: float = 1.0) -> dict:
    feats = pd.read_csv(FEATURES_PATH, parse_dates=["Date"])
    latest = feats[feats["Date"] == feats["Date"].max()].copy()
    latest = _compute_overload(latest, congestion_multiplier=congestion_multiplier)
    latest = latest.sort_values("overload_pct", ascending=False)

    before = latest[["Route_ID", "Route_Code", "Route_Type", "Total_Pax", "baseline_capacity", "overload_pct"]].copy()
    before = before.rename(columns={"overload_pct": "overload_before_pct"})

    after = _greedy_allocate(latest, budget=budget, relief_per_bus_pct=1.5)
    merged = before.merge(
        after[["Route_ID", "additional_units", "overload_after_pct"]],
        on="Route_ID",
        how="left",
    )
    merged["additional_units"] = merged["additional_units"].fillna(0).astype(int)
    merged["overload_after_pct"] = merged["overload_after_pct"].fillna(merged["overload_before_pct"])
    merged["stabilized"] = merged["overload_after_pct"] <= 10

    scenario_id = f"scenario_{budget}_{str(uuid4())[:8]}"
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_csv = OUT_DIR / f"{scenario_id}.csv"
    merged.to_csv(out_csv, index=False)

    return {
        "scenario_id": scenario_id,
        "budget": int(budget),
        "congestion_multiplier": float(congestion_multiplier),
        "routes_stabilized": int(merged["stabilized"].sum()),
        "capital_efficiency_routes_per_bus": float(merged["stabilized"].sum() / max(budget, 1)),
        "top_recommendations": merged.sort_values(
            ["additional_units", "overload_before_pct"], ascending=[False, False]
        )
        .head(10)
        .to_dict(orient="records"),
        "result_csv": str(out_csv),
    }


def run_all_default_scenarios() -> None:
    scenarios = [
        {"budget": 0, "congestion_multiplier": 1.0},
        {"budget": 30, "congestion_multiplier": 1.0},
        {"budget": 60, "congestion_multiplier": 1.0},
        {"budget": 90, "congestion_multiplier": 1.0},
        {"budget": 60, "congestion_multiplier": 1.05},
        {"budget": 60, "congestion_multiplier": 1.15},
        {"budget": 30, "congestion_multiplier": 0.90},
    ]
    outputs = [run_scenario(**s) for s in scenarios]
    out = ROOT / "artifacts/reports/scenario_index.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(outputs, indent=2), encoding="utf-8")
    print(f"Saved {len(outputs)} scenarios to {out}")


if __name__ == "__main__":
    run_all_default_scenarios()
