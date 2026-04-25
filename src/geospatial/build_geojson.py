from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]


def _to_feature(route_id: int, row: pd.DataFrame, props: dict) -> dict:
    coords = [[float(lon), float(lat)] for lat, lon in zip(row["Latitude"], row["Longitude"])]
    return {
        "type": "Feature",
        "geometry": {"type": "LineString", "coordinates": coords},
        "properties": {
            "route_id": int(route_id),
            **props,
        },
    }


def build_geojson() -> None:
    routes = pd.read_csv(ROOT / "Bus_Routes.csv")
    stops = pd.read_csv(ROOT / "Bus_Stops.csv")
    mapping = pd.read_csv(ROOT / "Route_Stop_Mapping.csv")
    feats = pd.read_csv(ROOT / "data/processed/route_day_features.csv", parse_dates=["Date"])

    routes["Route_ID"] = pd.to_numeric(routes["Route_ID"], errors="coerce").astype(int)
    stops["Stop_ID"] = pd.to_numeric(stops["Stop_ID"], errors="coerce").astype(int)
    mapping["Route_ID"] = pd.to_numeric(mapping["Route_ID"], errors="coerce").astype(int)
    mapping["Stop_ID"] = pd.to_numeric(mapping["Stop_ID"], errors="coerce").astype(int)

    latest = feats[feats["Date"] == feats["Date"].max()].copy()
    latest["overload_pct"] = (
        ((latest["Total_Pax"] - latest["rolling_7_mean"]) / latest["rolling_7_mean"])
        .replace([float("inf"), float("-inf")], 0)
        .fillna(0)
        * 100
    )
    latest = latest[["Route_ID", "Total_Pax", "overload_pct", "Route_Type"]].drop_duplicates("Route_ID")

    map_df = mapping.merge(stops, on="Stop_ID", how="left").sort_values(["Route_ID", "Stop_Sequence"])
    map_df = map_df.merge(routes, on="Route_ID", how="left").merge(latest, on="Route_ID", how="left", suffixes=("", "_latest"))

    route_features: list[dict] = []
    for route_id, grp in map_df.groupby("Route_ID"):
        valid = grp.dropna(subset=["Latitude", "Longitude"])
        if valid.shape[0] < 2:
            continue
        first = valid.iloc[0]
        props = {
            "route_code": first.get("Route_Code"),
            "route_type": first.get("Route_Type"),
            "route_name": f"Route {route_id}",
            "stop_count": int(valid["Stop_ID"].nunique()),
            "avg_demand_last_30d": float(feats[feats["Route_ID"] == route_id].tail(30)["Total_Pax"].mean()),
            "overload_pct": float(first.get("overload_pct", 0.0) if pd.notna(first.get("overload_pct")) else 0.0),
        }
        route_features.append(_to_feature(route_id, valid, props))

    stop_route_counts = mapping.groupby("Stop_ID")["Route_ID"].nunique().rename("routes_served_count").reset_index()
    stops_geo = stops.merge(stop_route_counts, on="Stop_ID", how="left")
    stops_geo["routes_served_count"] = stops_geo["routes_served_count"].fillna(0).astype(int)
    stop_features = []
    for _, s in stops_geo.iterrows():
        stop_features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [float(s["Longitude"]), float(s["Latitude"])]},
                "properties": {
                    "stop_id": int(s["Stop_ID"]),
                    "stop_name": s.get("Stop_Name"),
                    "zone": s.get("Zone"),
                    "routes_served_count": int(s["routes_served_count"]),
                },
            }
        )

    critical_ids = {101, 102, 103, 104, 105, 112}
    critical = [f for f in route_features if int(f["properties"]["route_id"]) in critical_ids]

    out_dir = ROOT / "artifacts/maps"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "routes.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": route_features}, indent=2), encoding="utf-8"
    )
    (out_dir / "stops.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": stop_features}, indent=2), encoding="utf-8"
    )
    (out_dir / "critical_corridors.geojson").write_text(
        json.dumps({"type": "FeatureCollection", "features": critical}, indent=2), encoding="utf-8"
    )
    print("Saved geojson maps to artifacts/maps")


if __name__ == "__main__":
    build_geojson()
