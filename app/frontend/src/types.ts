export type OverviewResponse = {
  as_of_date: string;
  total_active_routes: number;
  overloaded_routes: number;
  overloaded_pct: number;
  top_overloaded_routes: Array<{
    Route_ID: number;
    Route_Code: string;
    overload_pct: number;
  }>;
};

export type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: {
      type: "LineString" | "Point";
      coordinates: number[] | number[][];
    };
    properties: Record<string, unknown>;
  }>;
};

export type ScenarioRunResponse = {
  scenario_id: string;
  budget: number;
  congestion_multiplier: number;
  routes_stabilized: number;
  capital_efficiency_routes_per_bus: number;
  top_recommendations: Array<Record<string, unknown>>;
  result_csv: string;
};

// ── Forecast types ────────────────────────────────────────────────────────────

export type ForecastSeries = {
  Date: string;
  Total_Pax: number;
  pred_naive_lag_1: number;
  pred_ridge: number;
  pred_xgboost: number;
  split: string;
};

export type ForecastResponse = {
  route_id: number;
  split_filter: string;
  split_metrics: Record<string, { naive: number; ridge: number; xgboost: number }>;
  series: ForecastSeries[];
};

export type ModelMetrics = {
  MAPE: number;
  MAE: number;
  RMSE: number;
};

export type ValidationMetrics = {
  splits: Record<string, Record<string, ModelMetrics>>;
  feature_columns: string[];
  importance?: Array<{ feature: string; importance: number }>;
};

export type EdaResponse = {
  metric: "growth" | "route_type" | "congestion";
  label: string;
  series: Record<string, unknown>[];
};

export type RouteInfo = {
  Route_ID: number;
  Route_Code: string;
  Start_Stop: number;
  End_Stop: number;
  Route_Length_km: number;
  Avg_Travel_Time_Min: number;
  Route_Type: string;
};
