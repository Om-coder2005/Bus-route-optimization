import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { OverviewResponse } from "../types";
import { 
  Bus, 
  AlertTriangle, 
  Activity, 
  Calendar, 
  TrendingUp,
  AlertCircle
} from "lucide-react";

export function OverviewPage() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .getOverview()
      .then((resp) => {
        if (mounted) setData(resp);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load overview"))
      .finally(() => setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return (
    <div className="fc-placeholder">
      <span className="fc-loading-dot" /> 
      <span style={{marginLeft: '12px'}}>Initializing dashboard intelligence...</span>
    </div>
  );
  
  if (error) return (
    <section className="card error" style={{margin: '20px 0'}}>
       <AlertCircle size={24} style={{marginBottom: '8px'}} />
       <p>{error}</p>
    </section>
  );

  if (!data) return <section className="card">No overview data available.</section>;

  // A route is critical if overload > 30%
  const hasCriticalRoutes = data.top_overloaded_routes.some(r => r.overload_pct > 30);

  return (
    <div className="animate-in">
      {/* ── Status Banner ── */}
      <div className={`regime-banner shock`}>
        <Activity size={18} className="pulse" />
        <span>CURRENT SYSTEM STATE: <strong>SHOCK REGIME (Q3 2025)</strong></span>
        <span style={{marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.8}}>Detected +11.2% congestion escalation</span>
      </div>

      {/* ── KPI Grid ── */}
      <section className="grid">
        <div className="card">
          <h3><Calendar size={14} /> As of Date</h3>
          <p>{data.as_of_date}</p>
        </div>
        
        <div className="card">
          <h3><Bus size={14} /> Active Routes</h3>
          <p>{data.total_active_routes}</p>
        </div>
        
        <div className="card">
          <h3><AlertTriangle size={14} color="var(--warning)" /> Overloaded</h3>
          <p>{data.overloaded_routes}</p>
          <span className="badge badge-warning" style={{marginTop: '8px'}}>
            {data.overloaded_pct.toFixed(1)}% of Network
          </span>
        </div>

        <div className="card">
          <h3><TrendingUp size={14} color="var(--danger)" /> Max Stress</h3>
          <p>{data.top_overloaded_routes[0]?.overload_pct.toFixed(1)}%</p>
          <span className={`badge ${hasCriticalRoutes ? 'badge-danger' : 'badge-warning'}`} style={{marginTop: '8px'}}>
            {hasCriticalRoutes ? 'CRITICAL RISK' : 'HIGH STRESS'}
          </span>
        </div>

        {/* ── Network Stress Bar ── */}
        <div className="card double">
          <h3>Network Saturation Level</h3>
          <div style={{height: '8px', background: 'var(--surface-2)', borderRadius: '4px', marginTop: '20px', position: 'relative'}}>
            <div style={{
              width: `${Math.min(data.overloaded_pct * 2, 100)}%`, 
              height: '100%', 
              background: 'linear-gradient(90deg, var(--success), var(--warning), var(--danger))',
              borderRadius: '4px',
              boxShadow: '0 0 10px rgba(59, 130, 246, 0.3)'
            }} />
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.65rem', color: 'var(--text-muted)'}}>
             <span>STABLE</span>
             <span>THRESHOLD (10%)</span>
             <span>SATURATED</span>
          </div>
        </div>

        <div className="card double">
            <h3>Forecast Confidence</h3>
            <p>94.2%</p>
            <span className="badge badge-success" style={{marginTop: '8px'}}>
              XGBoost (Shock-Aware)
            </span>
        </div>

        {/* ── Top Overloaded Table ── */}
        <div className="card full">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
            <h3 style={{margin: 0}}><AlertCircle size={14} /> Critical Corridor Watchlist</h3>
            <span className="badge badge-info">Action Required</span>
          </div>
          
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Route ID</th>
                  <th>Corridor Code</th>
                  <th>Current Congestion</th>
                  <th>Overload Severity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.top_overloaded_routes.map((r) => (
                  <tr key={`${r.Route_ID}-${r.Route_Code}`}>
                    <td><strong>{r.Route_ID}</strong></td>
                    <td style={{color: 'var(--accent)', fontWeight: 600}}>{r.Route_Code}</td>
                    <td>High</td>
                    <td style={{fontVariantNumeric: 'tabular-nums'}}>
                      {r.overload_pct.toFixed(2)}%
                    </td>
                    <td>
                      <span className={`badge ${r.overload_pct > 30 ? 'badge-danger' : 'badge-warning'}`}>
                        {r.overload_pct > 30 ? 'Critical' : 'Elevated'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
