import { useState } from "react";
import { api } from "../services/api";
import type { ScenarioRunResponse } from "../types";
import { 
  Zap, 
  Target, 
  ShieldCheck, 
  BarChart2, 
  Download,
  AlertCircle,
  ArrowRight,
  Bus
} from "lucide-react";

export function OptimizationPage() {
  const [budget, setBudget] = useState(60);
  const [multiplier, setMultiplier] = useState(1.0);
  const [result, setResult] = useState<ScenarioRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.runScenario(budget, multiplier);
      setResult(resp);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to run optimization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in" style={{marginTop: '16px'}}>
      {/* ── Scenario Controls ── */}
      <section className="card full">
        <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
             <div style={{background: 'var(--accent)', padding: '10px', borderRadius: '12px', color: '#fff'}}>
                <Zap size={20} />
             </div>
             <div>
                <h3 style={{margin: 0}}>Optimization Studio</h3>
                <p style={{fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0}}>Greedy Fleet Allocation Engine (Relief Rate: 1.5% per unit)</p>
             </div>
        </div>

        <div className="controls-row">
          <label style={{minWidth: '220px'}}>
            Fleet Expansion Budget
            <div className="tabs" style={{marginTop: '8px', width: 'fit-content'}}>
              {[0, 30, 60, 90].map(b => (
                <button 
                  key={b} 
                  className={budget === b ? 'active' : ''} 
                  onClick={() => setBudget(b)}
                >
                  {b} Units
                </button>
              ))}
            </div>
          </label>

          <label style={{flex: 1, position: 'relative'}}>
            Congestion Multiplier: <strong>{multiplier.toFixed(2)}x</strong>
            <input
              type="range"
              min="0.8"
              max="1.5"
              step="0.05"
              value={multiplier}
              onChange={(e) => setMultiplier(Number(e.target.value))}
              style={{marginTop: '12px', width: '100%', accentColor: 'var(--accent)'}}
            />
            <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginTop: '4px'}}>
                <span>Baseline (0.8x)</span>
                <span>Neutral (1.0x)</span>
                <span>Hyper-Stress (1.5x)</span>
            </div>
          </label>

          <button 
            className="btn-primary" 
            onClick={run} 
            disabled={loading}
            style={{marginTop: 'auto', marginBottom: '4px'}}
          >
            {loading ? "Optimizing..." : "Execute Simulation"}
          </button>
        </div>
        {error ? (
            <div className="badge badge-danger" style={{padding: '8px 12px', width: '100%', justifyContent: 'center'}}>
                <AlertCircle size={14} style={{marginRight: '8px'}} /> {error}
            </div>
        ) : null}
      </section>

      {/* ── Results Dashboard ── */}
      {result ? (
        <section className="grid" style={{marginTop: '20px'}}>
          <div className="card">
            <h3><Target size={14} color="var(--success)" /> Stabilization Success</h3>
            <p>{result.routes_stabilized}</p>
            <span className="badge badge-success" style={{marginTop: '8px'}}>
              Routes &lt; 10% Overload
            </span>
          </div>
          
          <div className="card">
            <h3><BarChart2 size={14} color="var(--accent)" /> Capital Efficiency</h3>
            <p>{result.capital_efficiency_routes_per_bus.toFixed(2)}</p>
            <span className="badge badge-info" style={{marginTop: '8px'}}>
              Routes / Bus
            </span>
          </div>

          <div className="card double">
            <h3>Scenario Integrity</h3>
            <div style={{display: 'flex', gap: '16px', alignItems: 'center', height: '100%'}}>
                 <div style={{flex: 1}}>
                    <p style={{fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px'}}>Simulation ID</p>
                    <code style={{fontSize: '0.75rem', color: 'var(--text)'}}>{result.scenario_id}</code>
                 </div>
                 <button 
                  className="tabs" 
                  onClick={() => {
                    const baseUrl = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://127.0.0.1:8000";
                    window.open(`${baseUrl}/optimization/export/${result.scenario_id}`, "_blank");
                  }}
                  style={{padding: '8px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', cursor: 'pointer', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px'}}
                >
                    <Download size={14} />
                    <span style={{fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)'}}>Export CSV</span>
                 </button>
            </div>
          </div>

          <div className="card full">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                <h3 style={{margin: 0}}><ShieldCheck size={14} /> Fleet Allocation Schedule</h3>
                <span className="badge badge-success">Optimized Deployment</span>
            </div>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Baseline Load</th>
                    <th>Target Pax</th>
                    <th>Bus Units Added</th>
                    <th>Post-Deployment Overload</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.top_recommendations as any[]).map((r, i) => (
                    <tr key={r.Route_ID}>
                      <td>
                        <div style={{display: 'flex', flexDirection: 'column'}}>
                            <span style={{fontWeight: 700}}>{r.Route_ID}</span>
                            <span style={{fontSize: '0.7rem', color: 'var(--text-muted)'}}>{r.Route_Code} · {r.Route_Type}</span>
                        </div>
                      </td>
                      <td style={{fontVariantNumeric: 'tabular-nums'}}>{Math.round(r.baseline_capacity).toLocaleString()}</td>
                      <td style={{fontVariantNumeric: 'tabular-nums'}}>{Math.round(r.Total_Pax).toLocaleString()}</td>
                      <td>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <span style={{fontSize: '1rem', fontWeight: 700, color: 'var(--accent)'}}>+{r.additional_units}</span>
                            <Bus size={12} color="var(--accent)" />
                        </div>
                      </td>
                      <td>
                        <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                            <span style={{color: 'var(--text-muted)', fontSize: '0.75rem'}}>{r.overload_before_pct.toFixed(0)}%</span>
                            <ArrowRight size={10} color="var(--text-muted)" />
                            <span style={{fontWeight: 700, color: r.overload_after_pct <= 10 ? 'var(--success)' : 'var(--warning)'}}>
                                {r.overload_after_pct.toFixed(1)}%
                            </span>
                        </div>
                      </td>
                      <td>
                        {r.overload_after_pct <= 10 ? (
                           <span className="badge badge-success">Stabilized</span>
                        ) : (
                           <span className="badge badge-warning">Reduced</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <div className="fc-placeholder" style={{height: '300px', flexDirection: 'column', gap: '16px'}}>
            <BarChart2 size={48} color="var(--surface-2)" />
            <span>Select a budget and congestion level to begin simulation</span>
        </div>
      )}
    </div>
  );
}
