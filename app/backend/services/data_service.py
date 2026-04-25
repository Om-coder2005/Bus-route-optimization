from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[3]
FEATURES_PATH = ROOT / "data/processed/route_day_features.csv"
ROUTES_PATH = ROOT / "Bus_Routes.csv"
METRICS_PATH = ROOT / "artifacts/metrics/validation_results.json"


@lru_cache(maxsize=1)
def load_features() -> pd.DataFrame:
    if not FEATURES_PATH.exists():
        raise FileNotFoundError(
            f"Missing processed features file: {FEATURES_PATH}. Run src/pipelines/prepare_data.py first."
        )
    return pd.read_csv(FEATURES_PATH, parse_dates=["Date"])


@lru_cache(maxsize=1)
def load_routes() -> pd.DataFrame:
    return pd.read_csv(ROUTES_PATH)
