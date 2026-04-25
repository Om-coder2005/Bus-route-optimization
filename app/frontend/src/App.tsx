import { useMemo, useState } from "react";
import { OverviewPage } from "./pages/OverviewPage";
import { MapPage } from "./pages/MapPage";
import { ForecastPage } from "./pages/ForecastPage";
import { OptimizationPage } from "./pages/OptimizationPage";

type TabKey = "overview" | "map" | "forecast" | "optimization";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "map", label: "Network Map" },
  { key: "forecast", label: "Forecast Lab" },
  { key: "optimization", label: "Optimization" },
];

export function App() {
  const [tab, setTab] = useState<TabKey>("overview");

  const content = useMemo(() => {
    if (tab === "overview") return <OverviewPage />;
    if (tab === "map") return <MapPage />;
    if (tab === "forecast") return <ForecastPage />;
    return <OptimizationPage />;
  }, [tab]);

  return (
    <div className="layout">
      <header className="header">
        <h1>Dubai Bus Route Optimization</h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              id={`tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={tab === t.key ? "active" : ""}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>{content}</main>
    </div>
  );
}
