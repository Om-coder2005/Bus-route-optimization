import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell, Area, AreaChart, Brush, ReferenceLine, ScatterChart, Scatter
} from 'recharts';
import { 
  TrendingUp, 
  Activity, 
  BarChart as BarChartIcon, 
  Filter, 
  Calendar, 
  RefreshCcw, 
  Layers,
  ChevronRight,
  Info,
  Clock,
  Zap,
  Layout,
  Target,
  Download,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import type { ForecastResponse, ValidationMetrics, EdaResponse, RouteInfo } from '../types';
import '../forecast.css';

// ── Constants ───────────────────────────────────────────────────────────────
const MODEL_COLORS = {
  actual: "#e2e8f0",
  naive: "#94a3b8",
  ridge: "#60a5fa",
  xgboost: "#34d399",
  future: "#10b981",
  confidence: "rgba(52, 211, 153, 0.15)"
};

const ROUTE_TYPE_COLORS: Record<string, string> = {
  City: "#3b82f6",
  Express: "#f59e0b",
  Feeder: "#10b981",
  Intercity: "#8b5cf6",
};

// ── Custom Tooltip (Synced) ──────────────────────────────────────────────────
function SyncedTooltip({ active, payload, label, syncHover, setSyncHover }: any) {
  useEffect(() => {
    if (active && label) setSyncHover(label);
    else if (!active) setSyncHover(null);
  }, [active, label, setSyncHover]);

  if (!active || !payload || !payload.length) return null;
  return (
    <div className="fc-tooltip">
      <div className="fc-tooltip-date">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="fc-tooltip-row">
          <span className="fc-tooltip-dot" style={{ background: p.color }} />
          <span className="fc-tooltip-name">{p.name}</span>
          <span className="fc-tooltip-val">{Math.round(p.value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

export function ForecastPage() {
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number>(101);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [futureForecast, setFutureForecast] = useState<any[] | null>(null);
  const [metrics, setMetrics] = useState<ValidationMetrics | null>(null);
  const [edaMetric, setEdaMetric] = useState<"growth" | "route_type" | "congestion">("growth");
  const [edaData, setEdaData] = useState<EdaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Power BI Features
  const [horizon, setHorizon] = useState<number>(30); 
  const [viewMode, setViewMode] = useState<'historical' | 'future'>('historical');
  const [routeTypeFilter, setRouteTypeFilter] = useState<string>('All');
  const [isRetraining, setIsRetraining] = useState(false);
  const [syncHover, setSyncHover] = useState<string | null>(null);
  const [showModels, setShowModels] = useState({ naive: false, ridge: true, xgboost: true });

  const [error, setError] = useState<string | null>(null);

  // Initial Load
  useEffect(() => {
    Promise.all([api.getRoutes(), api.getMetrics()])
      .then(([r, m]) => {
        setRoutes(r);
        setMetrics(m);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Forecast Load
  useEffect(() => {
    if (viewMode === 'historical') {
      api.getRouteForecast(selectedRouteId)
        .then(setForecastData)
        .catch(e => setError(e.message));
    } else {
      api.getFutureForecast(selectedRouteId, horizon)
        .then(res => setFutureForecast(res.series))
        .catch(e => setError(e.message));
    }
  }, [selectedRouteId, viewMode, horizon]);

  // EDA Load
  useEffect(() => {
    api.getEda(edaMetric).then(setEdaData).catch(() => null);
  }, [edaMetric]);

  const filteredRoutes = useMemo(() => {
    if (routeTypeFilter === 'All') return routes;
    return routes.filter(r => r.Route_Type === routeTypeFilter);
  }, [routes, routeTypeFilter]);

  const handleRetrain = async () => {
    setIsRetraining(true);
    try {
      await api.retrainModels();
      // Simulation: wait and refresh metrics
      setTimeout(() => {
        api.getMetrics().then(setMetrics);
        setIsRetraining(false);
      }, 3000);
    } catch (e) {
      setIsRetraining(false);
    }
  };

  if (loading) return <div className="fc-placeholder">Initializing Forecast Lab Pro...</div>;

  return (
    <div className="fc-page pro-layout">
      {/* ── Sidebar Slicers (Power BI Style) ── */}
      <aside className="fc-sidebar">
        <div className="sidebar-section">
          <h3><Filter size={14} /> Slicers</h3>
          <div className="slicer-group">
            <label>Route Type</label>
            <select value={routeTypeFilter} onChange={(e) => setRouteTypeFilter(e.target.value)}>
              <option value="All">All Types</option>
              <option value="City">City</option>
              <option value="Express">Express</option>
              <option value="Feeder">Feeder</option>
              <option value="Intercity">Intercity</option>
            </select>
          </div>
          <div className="slicer-group">
            <label>Active Route</label>
            <select value={selectedRouteId} onChange={(e) => setSelectedRouteId(Number(e.target.value))}>
              {filteredRoutes.map(r => (
                <option key={r.Route_ID} value={r.Route_ID}>{r.Route_Code} ({r.Route_ID})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="sidebar-section">
          <h3><Clock size={14} /> Planning Horizon</h3>
          <div className="horizon-tabs">
            {[7, 30, 90, 180].map(h => (
              <button 
                key={h} 
                className={horizon === h ? 'active' : ''} 
                onClick={() => { setHorizon(h); setViewMode('future'); }}
              >
                {h === 7 ? '1W' : h === 30 ? '1M' : h === 90 ? '3M' : '6M'}
              </button>
            ))}
          </div>
          <button 
            className={`retrain-btn ${isRetraining ? 'spinning' : ''}`}
            onClick={handleRetrain}
            disabled={isRetraining}
          >
            <RefreshCcw size={14} /> {isRetraining ? 'Retraining...' : 'Refresh Intelligence'}
          </button>
        </div>

        <div className="sidebar-info">
          <Info size={14} />
          <p>Next Retrain cycle recommended in 142 days.</p>
        </div>
      </aside>

      {/* ── Main Dashboard Area ── */}
      <main className="fc-main-content">
        <header className="fc-pro-header">
           <div className="view-toggle">
              <button className={viewMode === 'historical' ? 'active' : ''} onClick={() => setViewMode('historical')}>Historical Validation</button>
              <button className={viewMode === 'future' ? 'active' : ''} onClick={() => setViewMode('future')}>Forward Projection</button>
           </div>
           <div className="status-badges">
              <span className="badge badge-success"><Activity size={10} /> Live Data Ingested</span>
              <span className="badge badge-info"><TrendingUp size={10} /> Growth: +2.4% MoM</span>
           </div>
        </header>

        {/* ── Main Forecasting Chart with Zoom/Brush ── */}
        <div className="fc-card fc-main-viz">
          <div className="fc-card-title">
             {viewMode === 'historical' ? 'Model Performance Analysis' : `Future Demand Projection (${horizon} Days)`}
             <span className="route-tag">Route {selectedRouteId}</span>
          </div>
          
          <ResponsiveContainer width="100%" height={350}>
            {viewMode === 'historical' ? (
              <LineChart data={forecastData?.series || []} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="Date" tick={{ fill: "#64748b", fontSize: 10 }} hide />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} />
                <Tooltip content={<SyncedTooltip syncHover={syncHover} setSyncHover={setSyncHover} />} />
                <Legend />
                <ReferenceLine x="2025-07-01" stroke="#ff2d55" label={{ value: "Shock", fill: "#ff2d55", fontSize: 10 }} />
                
                <Line type="monotone" dataKey="Total_Pax" name="Actual" stroke={MODEL_COLORS.actual} dot={false} strokeWidth={2} />
                {showModels.xgboost && <Line type="monotone" dataKey="pred_xgboost" name="XGBoost" stroke={MODEL_COLORS.xgboost} dot={false} strokeWidth={2} />}
                {showModels.ridge && <Line type="monotone" dataKey="pred_ridge" name="Ridge" stroke={MODEL_COLORS.ridge} dot={false} strokeWidth={1} strokeDasharray="3 3" />}
                
                <Brush dataKey="Date" height={30} stroke="#334155" fill="#0f172a" />
              </LineChart>
            ) : (
              <AreaChart data={futureForecast || []} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFuture" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={MODEL_COLORS.future} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={MODEL_COLORS.future} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="Date" tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} />
                <Tooltip content={<SyncedTooltip syncHover={syncHover} setSyncHover={setSyncHover} />} />
                <Area type="monotone" dataKey="Total_Pax" name="Projected" stroke={MODEL_COLORS.future} fillOpacity={1} fill="url(#colorFuture)" strokeWidth={3} />
                {/* Confidence Band Simulation */}
                <Area type="monotone" dataKey="Total_Pax" stroke="none" fill={MODEL_COLORS.confidence} />
                <Brush dataKey="Date" height={30} stroke="#334155" fill="#0f172a" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* ── Secondary Analysis Row (EDA & Importance) ── */}
        <div className="fc-secondary-grid">
           <div className="fc-card">
              <div className="fc-card-title">Network Analytics</div>
              <div className="eda-tabs pro">
                {['growth', 'route_type', 'congestion'].map(m => (
                  <button key={m} className={edaMetric === m ? 'active' : ''} onClick={() => setEdaMetric(m as any)}>
                    {m.replace('_', ' ').toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="viz-box">
                {edaData && <EdaPanel eda={edaData} />}
              </div>
           </div>

           <div className="fc-card">
              <div className="fc-card-title">Model Explainability</div>
              <div className="viz-box">
                {metrics?.importance && <ExplainabilityPanel importance={metrics.importance} />}
              </div>
           </div>

           <div className="fc-card metrics-mini">
              <div className="fc-card-title">Accuracy Score (OOT)</div>
              {metrics ? (
                <div className="gauge-wrap">
                  <div className="gauge-val">{(100 - metrics.splits.xgboost.out_of_time_q4.MAPE).toFixed(1)}%</div>
                  <div className="gauge-label">Reliability Index</div>
                  <div className="gauge-bar"><div className="fill" style={{width: '92%'}}></div></div>
                </div>
              ) : null}
           </div>
        </div>
      </main>
    </div>
  );
}

// ── Supporting Components (EdaPanel, ExplainabilityPanel as before but refined) ────────────────
function EdaPanel({ eda }: { eda: EdaResponse }) {
  if (eda.metric === "growth") {
    return (
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={eda.series as any}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="Date" hide />
          <YAxis hide />
          <Tooltip />
          <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  if (eda.metric === "route_type") {
    return (
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={eda.series as any}>
          <XAxis dataKey="Route_Type" tick={{fontSize: 10, fill: '#64748b'}} />
          <Tooltip />
          <Bar dataKey="avg_daily_pax" fill="#60a5fa" radius={[4,4,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return <div className="fc-placeholder">Chart coming soon...</div>;
}

function ExplainabilityPanel({ importance }: { importance: any[] }) {
  const data = importance.slice(0, 6).map(i => ({
    name: i.feature.replace('_', ' ').substring(0, 12),
    value: i.importance
  }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" hide />
        <YAxis dataKey="name" type="category" tick={{fontSize: 10, fill: '#94a3b8'}} width={70} />
        <Tooltip />
        <Bar dataKey="value" fill="#34d399" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
