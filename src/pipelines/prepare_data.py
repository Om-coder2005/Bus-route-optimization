from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT


@dataclass
class AuditRecord:
    check: str
    status: str
    detail: str


def _ensure_dirs() -> None:
    for rel in [
        "data/raw",
        "data/interim",
        "data/processed",
        "data/external",
        "artifacts/reports",
        "artifacts/maps",
        "artifacts/metrics",
        "artifacts/models",
    ]:
        (ROOT / rel).mkdir(parents=True, exist_ok=True)


def _parse_date_col(df: pd.DataFrame, col: str, source_name: str) -> pd.DataFrame:
    out = df.copy()
    # First pass: strict ISO then fallback to flexible parsing.
    parsed = pd.to_datetime(out[col], errors="coerce", format="%Y-%m-%d")
    fallback_mask = parsed.isna()
    if fallback_mask.any():
        parsed.loc[fallback_mask] = pd.to_datetime(
            out.loc[fallback_mask, col], errors="coerce"
        )

    out[col] = parsed.dt.date
    if out[col].isna().any():
        bad = out[out[col].isna()].head(5)
        raise ValueError(
            f"{source_name}: unable to parse some dates in column '{col}'. "
            f"Examples: {bad.to_dict(orient='records')}"
        )
    return out


def _load_csv(name: str) -> pd.DataFrame:
    return pd.read_csv(DATA_DIR / name)


def _validate_required_columns(df: pd.DataFrame, required: List[str], name: str) -> None:
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"{name}: missing required columns: {missing}")


def _normalize_traffic(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    _validate_required_columns(out, ["Date", "Congestion_Level", "Avg_Speed_kmph"], "traffic")
    out = _parse_date_col(out, "Date", "traffic")
    out["Congestion_Level"] = pd.to_numeric(out["Congestion_Level"], errors="coerce")
    out["Avg_Speed_kmph"] = pd.to_numeric(out["Avg_Speed_kmph"], errors="coerce")
    out = out.dropna(subset=["Date", "Congestion_Level", "Avg_Speed_kmph"])
    # Keep a single row per date by mean in case of duplicates.
    out = (
        out.groupby("Date", as_index=False)
        .agg(
            Congestion_Level=("Congestion_Level", "mean"),
            Avg_Speed_kmph=("Avg_Speed_kmph", "mean"),
        )
        .sort_values("Date")
    )
    return out


def _normalize_ridership(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    required = ["Route_ID", "Stop_ID", "Date", "Boarding_Count", "Alighting_Count"]
    _validate_required_columns(out, required, "ridership")
    out = _parse_date_col(out, "Date", "ridership")
    for col in ["Route_ID", "Stop_ID", "Boarding_Count", "Alighting_Count"]:
        out[col] = pd.to_numeric(out[col], errors="coerce")
    out = out.dropna(subset=required)
    for col in ["Route_ID", "Stop_ID", "Boarding_Count", "Alighting_Count"]:
        out[col] = out[col].astype(int)
    out["Total_Pax"] = out["Boarding_Count"] + out["Alighting_Count"]
    return out


def build_dataset() -> None:
    _ensure_dirs()
    audits: List[AuditRecord] = []

    # Core reference data
    routes = _load_csv("Bus_Routes.csv")
    stops = _load_csv("Bus_Stops.csv")
    mapping = _load_csv("Route_Stop_Mapping.csv")

    _validate_required_columns(
        routes, ["Route_ID", "Route_Code", "Route_Type"], "Bus_Routes.csv"
    )
    _validate_required_columns(stops, ["Stop_ID", "Latitude", "Longitude", "Zone"], "Bus_Stops.csv")
    _validate_required_columns(
        mapping, ["Route_ID", "Stop_ID", "Stop_Sequence"], "Route_Stop_Mapping.csv"
    )

    # Ridership (historical + shock + out-of-time)
    rid_hist = _normalize_ridership(_load_csv("Train_Ridership_2022_to_2025H1.csv"))
    rid_q3 = _normalize_ridership(_load_csv("Shock_Ridership_2025_Q3.csv"))
    rid_q4 = _normalize_ridership(_load_csv("OutOfTime_Ridership_2025_Q4.csv"))

    rid_hist["dataset_split"] = "train_hist"
    rid_q3["dataset_split"] = "eval_shock_q3"
    rid_q4["dataset_split"] = "oot_q4"
    ridership = pd.concat([rid_hist, rid_q3, rid_q4], ignore_index=True)

    # Traffic (historical + shock + out-of-time)
    tr_hist = _normalize_traffic(_load_csv("Train_Traffic_2022_to_2025H1.csv"))
    tr_q3 = _normalize_traffic(_load_csv("Shock_Traffic_2025_Q3.csv"))
    tr_q4 = _normalize_traffic(_load_csv("OutOfTime_Traffic_2025_Q4.csv"))
    traffic = pd.concat([tr_hist, tr_q3, tr_q4], ignore_index=True)
    traffic = (
        traffic.groupby("Date", as_index=False)
        .agg(
            Congestion_Level=("Congestion_Level", "mean"),
            Avg_Speed_kmph=("Avg_Speed_kmph", "mean"),
        )
        .sort_values("Date")
    )

    # Route-day demand aggregation
    route_day = (
        ridership.groupby(["Route_ID", "Date"], as_index=False)
        .agg(
            Total_Pax=("Total_Pax", "sum"),
            Boarding_Count=("Boarding_Count", "sum"),
            Alighting_Count=("Alighting_Count", "sum"),
            Stop_Observations=("Stop_ID", "nunique"),
        )
    )
    expected_route_day = route_day.shape[0]

    # Merge traffic by Date (dataset has no route-level traffic)
    route_day = route_day.merge(traffic, on="Date", how="left")
    route_day["Congestion_Level"] = route_day["Congestion_Level"].ffill()
    route_day["Avg_Speed_kmph"] = route_day["Avg_Speed_kmph"].ffill()

    # Route metadata
    routes["Route_ID"] = pd.to_numeric(routes["Route_ID"], errors="coerce").astype(int)
    route_day = route_day.merge(
        routes[
            [
                "Route_ID",
                "Route_Code",
                "Start_Stop",
                "End_Stop",
                "Route_Length_km",
                "Avg_Travel_Time_Min",
                "Route_Type",
            ]
        ],
        on="Route_ID",
        how="left",
    )

    # Stop + zone derived features
    mapping["Route_ID"] = pd.to_numeric(mapping["Route_ID"], errors="coerce").astype(int)
    mapping["Stop_ID"] = pd.to_numeric(mapping["Stop_ID"], errors="coerce").astype(int)
    stops["Stop_ID"] = pd.to_numeric(stops["Stop_ID"], errors="coerce").astype(int)

    route_stop_zone = mapping.merge(stops[["Stop_ID", "Zone"]], on="Stop_ID", how="left")
    route_zone_counts = (
        route_stop_zone.groupby(["Route_ID", "Zone"], as_index=False)
        .size()
        .rename(columns={"size": "zone_stop_count"})
    )
    route_stop_count = (
        route_stop_zone.groupby("Route_ID", as_index=False)
        .agg(stop_count=("Stop_ID", "nunique"))
    )
    route_zone_counts = route_zone_counts.merge(route_stop_count, on="Route_ID", how="left")
    route_zone_counts["zone_share"] = (
        route_zone_counts["zone_stop_count"] / route_zone_counts["stop_count"]
    )
    dominant_zone = (
        route_zone_counts.sort_values(["Route_ID", "zone_share"], ascending=[True, False])
        .drop_duplicates(subset=["Route_ID"])
        .rename(columns={"Zone": "dominant_zone"})[["Route_ID", "dominant_zone"]]
    )

    # Wide zone shares
    zone_pivot = (
        route_zone_counts.pivot_table(
            index="Route_ID", columns="Zone", values="zone_share", fill_value=0.0
        )
        .reset_index()
    )
    zone_pivot.columns = [
        "Route_ID" if c == "Route_ID" else f"zone_share_{str(c).lower()}" for c in zone_pivot.columns
    ]

    route_features = route_stop_count.merge(dominant_zone, on="Route_ID", how="left")
    route_features = route_features.merge(zone_pivot, on="Route_ID", how="left")
    route_day = route_day.merge(route_features, on="Route_ID", how="left")

    # Temporal features
    route_day["Date"] = pd.to_datetime(route_day["Date"])
    route_day = route_day.sort_values(["Route_ID", "Date"]).reset_index(drop=True)
    route_day["day_of_week"] = route_day["Date"].dt.dayofweek
    route_day["month"] = route_day["Date"].dt.month
    route_day["quarter"] = route_day["Date"].dt.quarter
    route_day["is_weekend"] = (route_day["day_of_week"] >= 5).astype(int)
    route_day["is_shock_regime"] = (route_day["Date"] >= pd.Timestamp("2025-07-01")).astype(int)
    route_day["is_oot_regime"] = (route_day["Date"] >= pd.Timestamp("2025-10-01")).astype(int)

    # Core lags
    route_day["lag_1"] = route_day.groupby("Route_ID")["Total_Pax"].shift(1)
    route_day["lag_7"] = route_day.groupby("Route_ID")["Total_Pax"].shift(7)
    route_day["rolling_7_mean"] = (
        route_day.groupby("Route_ID")["Total_Pax"].shift(1).rolling(7).mean().reset_index(level=0, drop=True)
    )

    # Audits
    audits.append(
        AuditRecord(
            check="route_day_row_count_preserved",
            status="pass" if route_day.shape[0] == expected_route_day else "fail",
            detail=f"expected={expected_route_day}, got={route_day.shape[0]}",
        )
    )
    audits.append(
        AuditRecord(
            check="route_metadata_join",
            status="pass" if route_day["Route_Type"].notna().all() else "fail",
            detail=f"null_route_type_rows={int(route_day['Route_Type'].isna().sum())}",
        )
    )
    audits.append(
        AuditRecord(
            check="traffic_join",
            status="pass" if route_day["Congestion_Level"].notna().all() else "fail",
            detail=f"null_congestion_rows={int(route_day['Congestion_Level'].isna().sum())}",
        )
    )

    # Persist outputs
    ridership.to_csv(ROOT / "data/interim/ridership_all_clean.csv", index=False)
    traffic.to_csv(ROOT / "data/interim/traffic_all_clean.csv", index=False)
    route_day.to_csv(ROOT / "data/processed/route_day_features.csv", index=False)

    audit_payload = {
        "status": "pass" if all(a.status == "pass" for a in audits) else "fail",
        "checks": [asdict(a) for a in audits],
        "row_counts": {
            "ridership_rows": int(ridership.shape[0]),
            "traffic_rows": int(traffic.shape[0]),
            "route_day_rows": int(route_day.shape[0]),
        },
        "date_range": {
            "min_date": str(route_day["Date"].min().date()),
            "max_date": str(route_day["Date"].max().date()),
        },
    }
    with open(ROOT / "artifacts/reports/merge_audit.json", "w", encoding="utf-8") as f:
        json.dump(audit_payload, f, indent=2)

    print("Data preparation completed.")
    print(f"Saved: {ROOT / 'data/processed/route_day_features.csv'}")
    print(f"Saved: {ROOT / 'artifacts/reports/merge_audit.json'}")


if __name__ == "__main__":
    build_dataset()
