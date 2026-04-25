import type {
  FeatureCollection,
  OverviewResponse,
  ScenarioRunResponse,
  ForecastResponse,
  ValidationMetrics,
  EdaResponse,
  RouteInfo,
} from "../types";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${message}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // ── Existing ──────────────────────────────────────────────────────────────
  getOverview: () => request<OverviewResponse>("/network/overview"),
  getRoutesGeo: () => request<FeatureCollection>("/network/map?overload=true"),
  getStopsGeo: () => request<FeatureCollection>("/network/map/stops"),
  runScenario: (budget: number, congestionMultiplier: number) =>
    request<ScenarioRunResponse>("/optimization/run", {
      method: "POST",
      body: JSON.stringify({ budget, congestion_multiplier: congestionMultiplier }),
    }),

  // ── New: forecast + analytics ─────────────────────────────────────────────
  getRoutes: () => request<RouteInfo[]>("/routes"),
  getRouteForecast: (routeId: number, split = "all") =>
    request<ForecastResponse>(`/routes/${routeId}/forecast?split=${split}`),
  getMetrics: () => request<ValidationMetrics>("/analytics/metrics"),
  getEda: (metric: "growth" | "route_type" | "congestion") =>
    request<EdaResponse>(`/analytics/eda?metric=${metric}`),

  getFutureForecast: (routeId: number, horizon: number) =>
    request<{ route_id: number; horizon: number; series: any[] }>(`/forecast/predict?route_id=${routeId}&horizon=${horizon}`),

  retrainModels: () =>
    request<{ status: string; message: string }>("/models/retrain", { method: "POST" }),
};
