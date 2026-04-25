import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../services/api";
import type { FeatureCollection } from "../types";
import "../map.css";

// ── Critical corridor route IDs (matches build_geojson.py) ──────────────────
const CRITICAL_IDS = new Set([101, 102, 103, 104, 105, 112]);

// ── Colour helpers ────────────────────────────────────────────────────────────
function overloadColor(pct: number, isCritical: boolean): string {
  if (isCritical) return "#ff2d55";
  if (pct > 30) return "#ff6b35";
  if (pct > 10) return "#ffc107";
  return "#00c48c";
}

function stopColor(count: number): string {
  if (count >= 4) return "#c084fc";
  if (count >= 2) return "#60a5fa";
  return "#94a3b8";
}

// ── Route type badge colours ─────────────────────────────────────────────────
const ROUTE_TYPE_COLOR: Record<string, string> = {
  City: "#3b82f6",
  Express: "#f59e0b",
  Feeder: "#10b981",
  Intercity: "#8b5cf6",
};

interface MapProps {
  routesGeo: FeatureCollection;
  stopsGeo: FeatureCollection;
  showCritical: boolean;
  showStops: boolean;
}

// ── Pure-Leaflet map renderer (no react-leaflet, avoids SSR/strict-mode headaches) ──
function LeafletMap({ routesGeo, stopsGeo, showCritical, showStops }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayersRef = useRef<L.Polyline[]>([]);
  const stopLayersRef = useRef<L.CircleMarker[]>([]);
  const criticalLayerRef = useRef<L.Polyline[]>([]);

  // ── Initial map mount ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const L = (window as typeof window & { L: typeof import("leaflet") }).L;

    const map = L.map(containerRef.current, {
      center: [25.2048, 55.2708],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
        maxZoom: 19,
      }
    ).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Draw routes ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routesGeo) return;
    const L = (window as typeof window & { L: typeof import("leaflet") }).L;

    // clear existing
    routeLayersRef.current.forEach((l) => l.remove());
    criticalLayerRef.current.forEach((l) => l.remove());
    routeLayersRef.current = [];
    criticalLayerRef.current = [];

    routesGeo.features.forEach((feat) => {
      if (feat.geometry.type !== "LineString") return;

      const props = feat.properties as {
        route_id: number;
        route_code: string;
        route_type: string;
        route_name: string;
        stop_count: number;
        avg_demand_last_30d: number;
        overload_pct: number;
      };

      const isCritical = CRITICAL_IDS.has(Number(props.route_id));
      const color = overloadColor(props.overload_pct ?? 0, isCritical);
      const coords = (feat.geometry.coordinates as number[][]).map(
        ([lng, lat]) => [lat, lng] as [number, number]
      );

      const weight = isCritical ? 5 : 3;
      const dashArray = isCritical ? undefined : undefined;

      const line = L.polyline(coords, {
        color,
        weight,
        opacity: 0.9,
        dashArray,
        className: isCritical ? "route-critical" : "route-normal",
      }).addTo(map);

      const typeColor = ROUTE_TYPE_COLOR[props.route_type] ?? "#6b7280";
      const routeTypeBadge = `<span class="badge" style="background:${typeColor}">${props.route_type}</span>`;
      const overloadBadge =
        props.overload_pct > 10
          ? `<span class="badge badge-warn">${props.overload_pct.toFixed(1)}% overload</span>`
          : `<span class="badge badge-ok">Normal</span>`;

      line.bindPopup(
        `<div class="popup">
          <div class="popup-title">Route ${props.route_id} · ${props.route_code}</div>
          <div class="popup-badges">${routeTypeBadge}${overloadBadge}${isCritical ? '<span class="badge badge-critical">Critical</span>' : ""}</div>
          <table class="popup-table">
            <tr><td>Stops</td><td><b>${props.stop_count}</b></td></tr>
            <tr><td>Avg demand (30d)</td><td><b>${Math.round(props.avg_demand_last_30d).toLocaleString()} pax</b></td></tr>
            <tr><td>Overload</td><td><b>${props.overload_pct.toFixed(2)}%</b></td></tr>
          </table>
        </div>`,
        { maxWidth: 280 }
      );

      line.on("mouseover", () => {
        line.setStyle({ weight: weight + 2, opacity: 1 });
      });
      line.on("mouseout", () => {
        line.setStyle({ weight, opacity: 0.9 });
      });

      if (isCritical) {
        criticalLayerRef.current.push(line);
      } else {
        routeLayersRef.current.push(line);
      }
    });
  }, [routesGeo]);

  // ── Draw stops ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !stopsGeo) return;
    const L = (window as typeof window & { L: typeof import("leaflet") }).L;

    stopLayersRef.current.forEach((l) => l.remove());
    stopLayersRef.current = [];

    if (!showStops) return;

    stopsGeo.features.forEach((feat) => {
      if (feat.geometry.type !== "Point") return;

      const props = feat.properties as {
        stop_id: number;
        stop_name: string;
        zone: string;
        routes_served_count: number;
      };

      const [lng, lat] = feat.geometry.coordinates as number[];
      const color = stopColor(props.routes_served_count ?? 0);

      const marker = L.circleMarker([lat, lng], {
        radius: Math.min(3 + props.routes_served_count, 8),
        color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 1,
      }).addTo(map);

      marker.bindPopup(
        `<div class="popup">
          <div class="popup-title">${props.stop_name}</div>
          <table class="popup-table">
            <tr><td>Stop ID</td><td><b>${props.stop_id}</b></td></tr>
            <tr><td>Zone</td><td><b>${props.zone}</b></td></tr>
            <tr><td>Routes served</td><td><b>${props.routes_served_count}</b></td></tr>
          </table>
        </div>`,
        { maxWidth: 240 }
      );

      stopLayersRef.current.push(marker);
    });
  }, [stopsGeo, showStops]);

  // ── Critical highlight toggle ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    criticalLayerRef.current.forEach((l) => {
      if (showCritical) {
        const el = (l as L.Polyline).getElement();
        if (el) el.classList.add("critical-glow");
        l.setStyle({ weight: 7, opacity: 1 });
      } else {
        const el = (l as L.Polyline).getElement();
        if (el) el.classList.remove("critical-glow");
        l.setStyle({ weight: 5, opacity: 0.9 });
      }
    });
  }, [showCritical]);

  return <div ref={containerRef} className="leaflet-container-custom" />;
}

// ── Legend component ──────────────────────────────────────────────────────────
function MapLegend() {
  return (
    <div className="map-legend">
      <div className="legend-title">Overload Status</div>
      <div className="legend-item">
        <span className="legend-dot" style={{ background: "#ff2d55" }} />
        Critical corridor
      </div>
      <div className="legend-item">
        <span className="legend-dot" style={{ background: "#ff6b35" }} />
        High overload (&gt;30%)
      </div>
      <div className="legend-item">
        <span className="legend-dot" style={{ background: "#ffc107" }} />
        Moderate (10–30%)
      </div>
      <div className="legend-item">
        <span className="legend-dot" style={{ background: "#00c48c" }} />
        Normal (&lt;10%)
      </div>
      <div className="legend-divider" />
      <div className="legend-title">Stops</div>
      <div className="legend-item">
        <span className="legend-dot" style={{ background: "#c084fc" }} />
        Hub (≥4 routes)
      </div>
      <div className="legend-item">
        <span className="legend-dot" style={{ background: "#60a5fa" }} />
        Interchange (2–3)
      </div>
      <div className="legend-item">
        <span className="legend-dot" style={{ background: "#94a3b8" }} />
        Regular (1)
      </div>
    </div>
  );
}

// ── Stats bar above map ───────────────────────────────────────────────────────
interface StatsBarProps {
  routesGeo: FeatureCollection;
  stopsGeo: FeatureCollection;
}
function StatsBar({ routesGeo, stopsGeo }: StatsBarProps) {
  const totalRoutes = routesGeo.features.length;
  const totalStops = stopsGeo.features.length;
  const criticalCount = routesGeo.features.filter((f) =>
    CRITICAL_IDS.has(Number(f.properties.route_id))
  ).length;
  const overloadedCount = routesGeo.features.filter(
    (f) => Number(f.properties.overload_pct) > 10
  ).length;

  const stats = [
    { label: "Total Routes", value: totalRoutes, color: "#60a5fa" },
    { label: "Bus Stops", value: totalStops, color: "#34d399" },
    { label: "Critical Corridors", value: criticalCount, color: "#ff2d55" },
    { label: "Overloaded Routes", value: overloadedCount, color: "#ff6b35" },
  ];

  return (
    <div className="map-stats-bar">
      {stats.map((s) => (
        <div className="stat-chip" key={s.label}>
          <span className="stat-value" style={{ color: s.color }}>
            {s.value}
          </span>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function MapPage() {
  const [routesGeo, setRoutesGeo] = useState<FeatureCollection | null>(null);
  const [stopsGeo, setStopsGeo] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [leafletReady, setLeafletReady] = useState(false);
  const [showCritical, setShowCritical] = useState(true);
  const [showStops, setShowStops] = useState(true);

  // Dynamically load Leaflet CSS + JS (avoids any bundler issues)
  useEffect(() => {
    // CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    // JS
    if ((window as unknown as Record<string, unknown>)["L"]) {
      setLeafletReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    Promise.all([api.getRoutesGeo(), api.getStopsGeo()])
      .then(([routes, stops]) => {
        setRoutesGeo(routes);
        setStopsGeo(stops);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load map data")
      )
      .finally(() => setLoading(false));
  }, []);

  const handleCriticalToggle = useCallback(() => setShowCritical((v) => !v), []);
  const handleStopsToggle = useCallback(() => setShowStops((v) => !v), []);

  if (error)
    return (
      <div className="map-error">
        <span>⚠ {error}</span>
      </div>
    );

  if (loading || !leafletReady)
    return (
      <div className="map-loading">
        <div className="spinner" />
        <span>Loading Dubai route map…</span>
      </div>
    );

  return (
    <div className="map-page">
      {/* Top stats bar */}
      {routesGeo && stopsGeo && (
        <StatsBar routesGeo={routesGeo} stopsGeo={stopsGeo} />
      )}

      {/* Controls toolbar */}
      <div className="map-toolbar">
        <span className="toolbar-title">Map Layers</span>
        <button
          id="toggle-critical"
          className={`toolbar-btn ${showCritical ? "active" : ""}`}
          onClick={handleCriticalToggle}
          title="Highlight critical corridors (routes 101–105, 112)"
        >
          <span className="btn-dot" style={{ background: "#ff2d55" }} />
          Critical Corridors
        </button>
        <button
          id="toggle-stops"
          className={`toolbar-btn ${showStops ? "active" : ""}`}
          onClick={handleStopsToggle}
          title="Toggle bus stop markers"
        >
          <span className="btn-dot" style={{ background: "#60a5fa" }} />
          Bus Stops
        </button>
      </div>

      {/* Map + Legend */}
      <div className="map-wrapper">
        {routesGeo && stopsGeo && (
          <LeafletMap
            routesGeo={routesGeo}
            stopsGeo={stopsGeo}
            showCritical={showCritical}
            showStops={showStops}
          />
        )}
        <MapLegend />
      </div>
    </div>
  );
}
