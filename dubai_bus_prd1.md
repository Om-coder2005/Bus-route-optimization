**PRODUCT REQUIREMENTS DOCUMENT**

**Dubai Bus Route Optimization &**

**Demand Forecasting Platform**

Version 2.0 | April 2026

**Status: Ready for Development**

| Attribute | Value |
| --- | --- |
| Document Version | 2.0 |
| Status | Approved for Development |
| Product Type | ML + Geospatial Decision-Support Platform |
| Target Domain | Dubai Public Transit — RTA Bus Network |
| Forecast Horizon | July – December 2025 (extendable) |
| Primary Model | XGBoost Regression (shock-aware) |
| Deployment Target | Demo-ready web app + Jupyter notebooks |
| Last Revised | April 2026 |

# 1\. Executive Summary

This document specifies the complete requirements to build the Dubai Bus Route Optimization and Demand Forecasting Platform — an end-to-end machine learning and decision-support system for RTA's bus network.

The platform addresses a documented structural shift in Q3 2025 where average congestion increased approximately 11% relative to H1 2025, producing overload conditions across nearly half the active routes, concentrated in six critical corridors (Routes 101–105, 112). Static capacity planning cannot handle this non-stationary, route-heterogeneous system.

The system answers three core operational questions:

*   WHERE are routes operating and which corridors are under stress? (Geospatial Layer)
*   WHAT will daily route demand look like under changing congestion and calendar conditions? (Forecasting Layer)
*   WHERE should limited fleet resources be deployed for maximum system stabilization? (Optimization Layer)

_This PRD is structured to allow a student/small team to build the project in six phases, from data foundation to a demo-ready dashboard._

# 2\. Problem Statement

## 2.1 Context

Dubai's bus network spans CBD, tourism, residential, and industrial corridors with fundamentally different demand dynamics. The network is not uniform: growth rates, weekday/weekend splits, and congestion sensitivity vary sharply by corridor type.

## 2.2 The Q3 2025 Congestion Shock

The network experienced a documented regime shift in Q3 2025:

*   Average congestion increased ~11% relative to H1 2025 baseline.
*   ~50% of routes show overload conditions.
*   Overload is concentrated: Routes 104, 105, 103, 112, 102, and 101 account for the majority of stress.
*   Speed degradation under congestion creates a secondary demand suppression effect that is route-heterogeneous.

## 2.3 Why Existing Approaches Fail

| Approach | Failure Mode |
| --- | --- |
| Static capacity planning | Assumes stationarity; ignores regime shift |
| Uniform fleet expansion | Wastes capital on low-stress corridors |
| Route-agnostic forecasting | Misses heterogeneous zone and type dynamics |
| Random-split ML validation | Creates temporal leakage; inflates accuracy metrics |
| Manual threshold tuning | Cannot generalize across 2022–2025 growth arc |

## 2.4 Problem Decomposition

| Layer | Core Question | Output |
| --- | --- | --- |
| Data Layer | What happened on each route and day? | Clean route-day merged dataset |
| Analytics Layer | What patterns drive demand? | Growth, seasonality, congestion insights |
| Forecasting Layer | What will demand be? | Daily route-level predictions (Jul–Dec 2025) |
| Optimization Layer | Where should buses be added? | Fleet allocation plan under budget constraint |
| Geospatial Layer | Where are routes and risks located? | Interactive route map with overload overlays |
| Presentation Layer | How is the decision explained? | Dashboard and presentation-ready visuals |

# 3\. Objectives

## 3.1 Business Objectives

*   Forecast route-level daily passenger demand for July–December 2025 and comparable future periods.
*   Identify overload-risk corridors, underutilized capacity, and emerging demand imbalances.
*   Convert forecast gaps into actionable fleet allocation recommendations under budget constraints (30, 60, 90 additional units).
*   Provide map-based visibility of route paths, stop sequences, and stressed corridors.
*   Support sensitivity testing for congestion escalation and demand shock scenarios.

## 3.2 Technical Objectives

*   Build a reproducible, auditable data pipeline integrating route, stop, ridership, traffic, and external calendar signals.
*   Train a shock-aware forecasting model with strict time-based validation (no random splits).
*   Build a geospatial module that reconstructs route topology from route-stop mappings and stop coordinates.
*   Implement a constrained fleet optimization engine that minimizes maximum route overload within a fleet budget.
*   Expose results through an interactive dashboard suitable for demonstration, presentation, and operational review.
*   Provide model explainability (SHAP / feature importance) so recommendations are justifiable.

## 3.3 Success Metrics

| Metric | Target | Measurement Method |
| --- | --- | --- |
| Pre-shock MAPE | < 10% | Time-based validation on pre-Q3 2025 slice |
| Shock-period MAPE improvement | > 15% better than naive baseline | Residual analysis on Q3 2025 data |
| Out-of-time MAPE (Q4 2025) | < 15% | Holdout set evaluation |
| Overload corridor recall | Top 6 routes identified correctly | Route ranking vs documented critical list |
| Optimization solve time | < 30 seconds for any scenario | Timed execution in app/notebook |
| Map render time | < 3 seconds for full network | Browser timing on demo machine |
| Dashboard page load | < 5 seconds | Manual timing on demo machine |
| Data merge integrity | 0 phantom route-days after join | Row count audit post-merge |

# 4\. Users & Stakeholders

| User Type | Role | Primary Need | Key Success Indicator |
| --- | --- | --- | --- |
| Project Team | Builders & presenters | Build, validate, and demo the system | All 6 phases deliverable |
| Judges / Evaluators | Competition reviewers | Assess analytical rigor and product quality | Clear data→forecast→decision flow |
| Transport Analysts | Domain experts | Route demand and fleet recommendations | Actionable corridor rankings |
| Presentation Audience | Non-technical viewers | Visual corridor stress explanation | Map is self-explanatory |
| Technical Reviewers | Data / ML auditors | Data quality, model validity, optimization logic | Reproducible pipeline, no leakage |

# 5\. Scope

## 5.1 In Scope

*   Multi-source dataset integration using Route\_ID, Stop\_ID, and Date as join keys.
*   Route-level daily demand forecasting using supervised ML (XGBoost primary, baselines required).
*   Geospatial route visualization on a Dubai basemap using route-stop stop-sequence relationships.
*   Feature engineering across temporal, operational, structural, zone, network-share, and regime dimensions.
*   Public holiday and major-event calendar enrichment using official UAE and Dubai sources.
*   Constrained fleet allocation optimization with scenario simulation (30/60/90 units + congestion stress).
*   Analytical dashboard with model outputs, overload scoring, and recommendation summaries.
*   Model explainability outputs (SHAP values or permutation importance).
*   Downloadable processed datasets, GeoJSON route files, and recommendation CSVs.

## 5.2 Explicitly Out of Scope

*   Real-time AVL/GPS ingestion (no live data pipeline in this version).
*   Minute-level dynamic dispatching or operational scheduling.
*   Individual passenger-level demand prediction.
*   Infrastructure redesign, fare optimization, or modal substitution modeling.
*   Full production deployment integrated with live RTA systems.
*   Weather API integration (noted as future extensibility, not current requirement).
*   Multi-modal demand (Metro, Tram, Marine) — bus network only.

# 6\. Data Requirements

_⚠ CRITICAL: All joins must use composite keys (Route\_ID + Date or Route\_ID + Stop\_ID). A single-key merge on Route\_ID alone will produce corridor distortion. Row counts must be audited before and after every join._

## 6.1 Required Internal Datasets

| File | Key Fields | Purpose | Validation Check |
| --- | --- | --- | --- |
| Bus_Routes.csv | Route_ID, Route_Type, Route_Name | Route metadata and type classification | No duplicate Route_IDs; Route_Type is one of: City, Express, Feeder, Intercity |
| Bus_Stops.csv | Stop_ID, Latitude, Longitude, Zone | Stop coordinates and zone labels | Lat/Long within Dubai bounding box [24.7–25.4°N, 54.9–55.6°E]; no null coordinates |
| Route_Stop_Mapping.csv | Route_ID, Stop_ID, Stop_Sequence | Route topology and stop order | Every Route_ID in Bus_Routes appears; stop sequences are contiguous integers per route |
| Train_Ridership_2022_to_2025H1.csv | Route_ID, Stop_ID, Date, Boarding_Count, Alighting_Count | Historical demand observations | Date range Jan 2022 – Jun 2025; no negative counts; boarding+alighting > 0 for active routes |
| Train_Traffic_2022_to_2025H1.csv | Route_ID, Date, Congestion_Level, Avg_Speed_Kmph | Traffic and congestion signals | Speed > 0; Congestion_Level within expected range; no future-dated rows |
| Shock/OOT Validation Files | Same schema as ridership | Q3 2025 shock evaluation + Q4 2025 holdout | Must be temporally isolated from training data — never sample into training set |

## 6.2 External Enrichment Datasets

| Source | Data Type | How to Acquire | Encoding |
| --- | --- | --- | --- |
| UAE Federal Holidays (official gov.ae) | Public holiday dates + type | Manual extraction or public API; verify annually | Binary is_public_holiday flag + holiday_type categorical |
| Dubai Tourism Event Calendar | Major event dates + category | Manual curation from visitdubai.com or DTCM | is_major_event_day + event_category + event_intensity_score (1–3 scale) |
| OpenStreetMap / Leaflet basemap tiles | Background map tiles | Free via Leaflet.js tile provider (no API key needed) | XYZ tile format |
| Mapbox (optional) | Enhanced styled tiles | Mapbox API key required; free tier sufficient | GL JS vector tiles |

## 6.3 Target Variable Definition

Primary target: Total\_Pax per Route\_ID per Date

*   Definition: Total\_Pax = sum(Boarding\_Count + Alighting\_Count) across all stops for a given Route\_ID and Date.
*   Aggregation level: Route-day (one row = one route, one calendar day).
*   Zero-demand days: Routes with Total\_Pax = 0 for a full day should be flagged — they may represent service suspensions, not true zero demand, and should be excluded from training or encoded separately.

## 6.4 Data Merge Logic (Explicit)

Execute joins in this exact order to prevent row explosion:

1.  Start with ridership file aggregated to Route\_ID + Date level (sum Boarding + Alighting across stops).
2.  Left-join traffic file on Route\_ID + Date. Audit for nulls — missing traffic data should be forward-filled within route groups, not dropped.
3.  Left-join route metadata (Bus\_Routes.csv) on Route\_ID. Every ridership row must match a route — unmatched rows are a data error.
4.  Join Route\_Stop\_Mapping on Route\_ID to count stops and derive zone exposure percentages.
5.  Join external calendar features on Date.
6.  Final audit: row count should equal unique (Route\_ID × Date) combinations in the ridership file.

# 7\. Feature Engineering Blueprint

## 7.1 Core Temporal Features

| Feature | Derivation | Notes |
| --- | --- | --- |
| day_of_week | Date.weekday() | 0=Mon, 6=Sun |
| month | Date.month | Captures seasonal pattern |
| quarter | Date.quarter | Coarser seasonal grouping |
| is_weekend | day_of_week >= 5 | Binary; strong demand split |
| time_index | Integer day offset from 2022-01-01 | Captures growth trend |
| is_peak_season | month in [11,12,1,2,3] | Nov–Mar Dubai high season |

## 7.2 Lag and Rolling Features

| Feature | Derivation | Notes |
| --- | --- | --- |
| lag_1 | Total_Pax shifted 1 day, per Route_ID | Must be computed within route group |
| lag_7 | Total_Pax shifted 7 days, per Route_ID | Same weekday last week |
| lag_14 | Total_Pax shifted 14 days, per Route_ID | Two-week memory |
| rolling_7_mean | 7-day rolling mean of Total_Pax, per Route_ID | Smooth short-term trend |
| rolling_7_std | 7-day rolling std of Total_Pax, per Route_ID | Demand volatility signal |
| rolling_14_mean | 14-day rolling mean, per Route_ID | Medium-term trend |

_⚠ All lag/rolling features must be computed per Route\_ID group BEFORE the train/test split. Rolling features must use only past data — no look-ahead. Any row where a lag is undefined (first N days of each route) should be dropped from training._

## 7.3 Operational Features

| Feature | Derivation |
| --- | --- |
| congestion_level | Raw from traffic file; normalize 0–1 optionally |
| avg_speed_kmph | Raw from traffic file |
| high_congestion_flag | Binary: congestion_level > H1 2025 75th percentile |
| congestion_delta_vs_h1_2025 | congestion_level minus route-level H1 2025 mean |
| speed_drop_vs_baseline | avg_speed_kmph minus route-level H1 2025 mean speed |

## 7.4 Structural Features

| Feature | Derivation |
| --- | --- |
| route_id_code | Label-encoded Route_ID integer |
| route_type_code | Label-encoded Route_Type (City/Express/Feeder/Intercity) |
| stop_count | Count of stops in Route_Stop_Mapping for this Route_ID |
| route_length_km | Approximate: sum of Haversine distances between consecutive stops (if stop order available) |
| dominant_zone | Zone with highest stop_count fraction for this route |

## 7.5 Zone Exposure Features

*   pct\_stops\_cbd, pct\_stops\_tourism, pct\_stops\_residential, pct\_stops\_industrial — fraction of stops in each zone category.
*   zone\_avg\_demand\_lag\_7 — rolling 7-day average of Total\_Pax across all routes sharing the dominant zone.
*   zone\_avg\_congestion — rolling average congestion across routes in the same dominant zone.

## 7.6 Network-Share Features

*   route\_demand\_share\_lag\_1 — route's share of total network demand, lagged 1 day.
*   route\_demand\_share\_lag\_7 — same, lagged 7 days.
*   network\_total\_demand\_lag\_1 — total network demand lagged 1 day (absolute level indicator).
*   network\_total\_demand\_roll\_7 — 7-day rolling total network demand.

_⚠ Network share features are powerful but require that network totals are computed from only routes present in the training set on each day. Avoid including test-period routes in network total computation._

## 7.7 Calendar & Event Features

| Feature | Derivation | Notes |
| --- | --- | --- |
| is_public_holiday | Binary: date in UAE holiday calendar | Source: official gov.ae |
| holiday_type | Categorical: national/religious/other | Eid, National Day, New Year etc. |
| days_to_holiday | Days until next public holiday | Pre-holiday demand signal |
| days_after_holiday | Days since last public holiday | Post-holiday recovery |
| is_major_event_day | Binary: date in Dubai event calendar | Source: DTCM / visitdubai.com |
| event_category | Categorical: sports/expo/concert/conference | Manual label |
| event_intensity_score | Ordinal 1–3: local/national/international | Manual label; 3 = Formula E, Expo-scale |

## 7.8 Regime Features

| Feature | Derivation | Notes |
| --- | --- | --- |
| is_shock_regime | Binary: date >= 2025-07-01 | Marks Q3 2025 onset |
| post_q3_2025 | Binary: date >= 2025-10-01 | Q4 holdout marker (never use in training) |
| congestion_regime_band | Categorical: LOW / MID / HIGH based on percentile thresholds | Derived from full historical congestion distribution |

# 8\. Machine Learning & Forecasting Module

## 8.1 Problem Framing

Route-level daily time-series regression with tabular feature engineering. Not a pure deep-learning sequence problem. Not a classification problem. Each row is a (Route\_ID, Date) pair; the label is Total\_Pax.

## 8.2 Validation Design (CRITICAL — No Random Splits)

| Split | Date Range | Purpose | How Used |
| --- | --- | --- | --- |
| Training | Jan 2022 – Mar 2025 | Model fitting | XGBoost training data |
| Pre-shock Validation | Apr 2025 – Jun 2025 | Tune hyperparams, assess fit quality | MAE/MAPE target < 10% |
| Shock Evaluation | Jul 2025 – Sep 2025 | Test shock-aware recalibration | Compare baseline vs shock-aware model |
| Out-of-Time Holdout | Oct 2025 – Dec 2025 | Final unbiased evaluation | Touch only once; never tune on this |

_⚠ The Q4 2025 holdout must be kept completely isolated until final evaluation. Viewing performance on this split during development constitutes leakage._

## 8.3 Model Candidates

| Model | Purpose | Required? |
| --- | --- | --- |
| Naive lag (yesterday's value) | Minimum benchmark | Yes — must beat this |
| 7-day same-weekday lag | Seasonal naive baseline | Yes — must beat this |
| Linear Regression / Ridge | Interpretable linear baseline | Yes — shows linear sensitivity |
| Random Forest Regressor | Tree ensemble baseline | Recommended |
| XGBoost Regressor | Primary model | Yes — core deliverable |
| LightGBM or CatBoost | Optional alternative boosting | Nice-to-have |

## 8.4 Shock-Aware Recalibration (Required)

The baseline XGBoost model will underpredict during Q3 2025 because it was trained on a pre-shock distribution. Three specific techniques must be implemented:

*   Regime indicator features: is\_shock\_regime and congestion\_regime\_band added to the feature set.
*   Extended trend features: congestion\_delta\_vs\_h1\_2025 and speed\_drop\_vs\_baseline capture the shift magnitude.
*   Iterative multi-step forecasting: for dates beyond the training horizon, use predicted lag values rather than actual lags — implement a recursive forecasting loop per route.

## 8.5 Evaluation Metrics

| Metric | Formula | Interpretation | Target |
| --- | --- | --- | --- |
| MAPE | mean(|actual - pred| / actual) × 100 | Scale-independent % error | < 10% pre-shock, < 15% OOT |
| MAE | mean(|actual - pred|) | Average passenger count error | Report alongside MAPE |
| RMSE | sqrt(mean((actual - pred)^2)) | Penalizes large deviations | Report alongside MAE |
| Route Ranking Accuracy | Top-6 overloaded routes identified | Operational corridor recall | 100% of documented critical routes |

## 8.6 Explainability Requirements

*   Global feature importance: XGBoost built-in gain/weight importance — show top 20 features.
*   SHAP summary plot: beeswarm plot showing feature-level impact distribution.
*   SHAP local explanation: for a selected route-day, show which features drove the specific prediction.
*   Partial dependence plots: show congestion\_level vs predicted demand (key for shock story).
*   Residual analysis: plot (actual - predicted) vs date to visualize shock onset.

## 8.7 Model Persistence

*   Save trained XGBoost model using model.save\_model('artifacts/models/xgb\_final.json').
*   Save feature list to artifacts/models/feature\_list.txt — required for consistent inference.
*   Save validation metrics to artifacts/metrics/validation\_results.json.
*   If MLflow is used, log all parameters, metrics, and artifacts in a named experiment.

# 9\. Optimization Engine

## 9.1 Core Formulation

Objective: Minimize maximum route overload subject to total fleet budget constraint.

| Symbol | Meaning |
| --- | --- |
| R | Set of all routes (i = 1 … N) |
| D_i | Forecast demand for route i |
| C_i | Baseline capacity for route i (approximated from H1 2025 throughput) |
| OL_i | Overload for route i = max(0, (D_i - C_i) / C_i) |
| x_i | Additional fleet units allocated to route i (decision variable, integer ≥ 0) |
| B | Total fleet budget (30, 60, or 90 units) |
| r | Fleet relief rate: each additional bus reduces OL proportionally |

*   Minimize: max(OL\_i - r × x\_i) over all routes i
*   Subject to: sum(x\_i) ≤ B; x\_i ≥ 0; x\_i integer

_⚠ The proportional fleet relief assumption (r) must be explicitly stated and sensitized. A ±20% sensitivity on r should be included in scenario outputs._

## 9.2 Optimization Scenarios (All Required)

| Scenario | Fleet Budget | Congestion Assumption | Purpose |
| --- | --- | --- | --- |
| Baseline | 0 additional units | Q3 2025 regime | Show current overload state |
| Conservative | 30 units | Q3 2025 regime | Minimum viable relief |
| Moderate | 60 units | Q3 2025 regime | Primary recommendation scenario |
| Aggressive | 90 units | Q3 2025 regime | Upper bound expansion |
| Stress Test Low | 60 units | +5% congestion above Q3 | Near-future sensitivity |
| Stress Test High | 60 units | +15% congestion above Q3 | Worst-case sensitivity |
| Congestion Reduction | 30 units | -10% congestion (intervention) | Show demand management value |

## 9.3 Optimization Outputs (Per Scenario)

*   Route-level overload before and after intervention.
*   Recommended additional fleet units per route (sorted descending by priority).
*   Count of stabilized routes (overload brought below 10% threshold).
*   Capital efficiency score: routes stabilized per additional bus.
*   Residual overload for routes still above threshold after full budget deployment.

## 9.4 Solver Recommendation

*   Greedy allocator: implement first as baseline — assign buses to highest-overload route iteratively.
*   Linear/integer programming: use scipy.optimize.linprog or PuLP for exact solution when N routes < 200.
*   OR-Tools: use for future extensibility if route count or constraint complexity grows.

# 10\. Geospatial Module

## 10.1 Route Reconstruction Logic

Routes are not stored as polylines. They must be reconstructed from Route\_Stop\_Mapping + Bus\_Stops:

1.  Join Route\_Stop\_Mapping with Bus\_Stops on Stop\_ID to get (latitude, longitude) per stop per route.
2.  Sort stops by Stop\_Sequence within each Route\_ID.
3.  Connect consecutive stops with straight-line segments (approximate) or OSRM-snapped roads (optional enhancement).
4.  If Stop\_Sequence is missing or non-contiguous: document the fallback (e.g., nearest-neighbor ordering from a seed stop); label all such routes as 'approximate topology.'

## 10.2 GeoJSON Output Specification

*   routes.geojson: FeatureCollection of LineString features, one per Route\_ID. Properties: route\_id, route\_name, route\_type, dominant\_zone, stop\_count, avg\_demand\_last\_30d, overload\_pct.
*   stops.geojson: FeatureCollection of Point features, one per Stop\_ID. Properties: stop\_id, stop\_name, zone, routes\_served (array).
*   critical\_corridors.geojson: Subset of routes.geojson filtered to Routes 101–105, 112 with enhanced styling properties.

## 10.3 Map View Requirements

| View | Trigger | Visual Encoding |
| --- | --- | --- |
| All-routes network | Default on load | Lines colored by route_type |
| Route-specific path | Click route or filter by Route_ID | Selected route highlighted, others dimmed |
| Overload heat map | Toggle: 'Show Overload' | Line color: green (< 10% OL) → yellow → red (> 30% OL) |
| Critical corridors | Button: 'Show Critical Routes' | Thick orange lines; pulsing animation if supported |
| Zone overlay | Toggle: 'Show Zones' | Background shading by zone type |
| Stop detail | Click any stop marker | Popup: Stop ID, Zone, Routes served, Avg daily pax |

## 10.4 Map Technical Requirements

*   Basemap: Leaflet.js with OpenStreetMap tiles (free, no API key) as default; Mapbox optional.
*   Dubai bounding box: \[24.7, 54.9\] to \[25.4, 55.6\] — center on load at approximately \[25.2, 55.3\].
*   Route popup on hover: show Route ID, name, type, current overload percentage.
*   Performance: limit initial render to 50 routes if full network causes browser lag; add a 'Load All' button.
*   Export: map should support PNG screenshot export for presentation use.

# 11\. Product Structure & User Experience

## 11.1 User Flow

| Step | User Action | System Response |
| --- | --- | --- |
| 1 | Open dashboard | Load Overview page with KPI cards and alert banners for critical corridors |
| 2 | Click 'Network Map' | Render all-routes map with overload color coding |
| 3 | Select a route on map or dropdown | Highlight route path; show demand trend chart for that route |
| 4 | Navigate to 'Demand Analytics' | Show EDA: growth decomposition, seasonal curves, route-type comparisons |
| 5 | Open 'Forecast Lab' | View actual vs predicted chart; switch between routes; see MAPE by route |
| 6 | Open 'Optimization Studio' | Select scenario (30/60/90 units); run optimization; view before/after overload table |
| 7 | Open 'Recommendations' | View prioritized corridor table; download as CSV; see rationale per corridor |

## 11.2 Dashboard Modules

| Module | Key Components | Data Source |
| --- | --- | --- |
| Overview | Total routes, % overloaded, top 3 critical routes, regime status banner | Optimization + forecast outputs |
| Network Map | Interactive route map with overload overlay and stop popups | GeoJSON + overload scores |
| Demand Analytics | Growth charts 2022–2025, seasonal decomposition, route-type comparison, congestion-demand scatter | Processed ridership + traffic |
| Forecast Lab | Actual vs predicted time series, model metrics table, SHAP plots, residual chart | Model outputs + SHAP values |
| Optimization Studio | Scenario selector, before/after overload table, stabilized route count, capital efficiency | Optimization engine outputs |
| Recommendations | Ranked corridor table, fleet allocation per route, residual risk, download button | Optimization outputs |

## 11.3 KPI Cards (Overview Page)

*   Total Active Routes | % Routes Overloaded | Top Overloaded Route (name + OL%) | Regime Status (PRE-SHOCK / SHOCK / STABILIZED)
*   Forecast Accuracy (MAPE on validation set) | Fleet Budget Used / Available (for selected scenario)

# 12\. Non-Functional Requirements

| Category | Requirement | Acceptance Criteria |
| --- | --- | --- |
| Reproducibility | Full pipeline from raw CSVs to dashboard outputs must be re-runnable | Single command or notebook run produces identical outputs given same inputs |
| Time-Correctness | No temporal leakage in model training or validation | Validation confirmed with time-based split; no future data in features |
| Explainability | Recommendations must be justifiable to non-technical stakeholder | SHAP plots present; top-3 feature drivers shown per recommendation |
| Performance | All dashboard interactions responsive on demo hardware | Page transitions < 3s; optimization solve < 30s; map render < 3s |
| Data Integrity | No silent merge errors | Row count audit logged after every join; merge audit report saved to artifacts/ |
| Usability | Non-technical judge understands map in < 2 minutes without explanation | Color legend present; tooltips on all chart elements; guided demo flow |
| Extensibility | Architecture allows future addition of weather, GTFS, GPS signals | Feature pipeline modular; external data joins documented as optional extension points |
| Portability | Project runs on any machine with Python 3.10+ and Node.js 18+ | requirements.txt + package.json fully specify dependencies; no hardcoded paths |

# 13\. System Architecture

## 13.1 Logical Architecture

| Layer | Components | Technology |
| --- | --- | --- |
| Ingestion | CSV readers, external calendar fetchers | pandas, requests |
| Processing | Join logic, aggregation, feature engineering pipeline | pandas, numpy, scikit-learn (preprocessing) |
| Model | Baseline models, XGBoost, SHAP explainer | xgboost, scikit-learn, shap |
| Optimization | Greedy allocator, LP/MIP solver, scenario runner | scipy, PuLP (or OR-Tools) |
| Spatial | GeoJSON builder, route topology reconstructor | geopandas, shapely |
| API | REST endpoints for all data/model/optimization outputs | FastAPI |
| Frontend | Dashboard pages, map component, chart components | React + TypeScript + Leaflet + Recharts |
| Persistence | Processed CSVs, model artifacts, GeoJSON, metrics | Local filesystem (PostgreSQL optional for production) |

## 13.2 Folder Structure

project/  
├── app/ │ ├── backend/ # FastAPI app │ │ ├── main.py │ │ ├── api/ # Route handlers │ │ ├── services/ # Business logic │ │ ├── schemas/ # Pydantic models │ │ └── utils/ │ └── frontend/ # React + TypeScript │ └── src/ │ ├── pages/ # Overview, Map, Forecast, Optimization, Recs │ ├── components/ # Map, Charts, Tables, KPICards │ ├── hooks/ # useRoutes, useScenarios │ └── services/ # API client ├── data/ │ ├── raw/ # Unmodified source files │ ├── interim/ # Merged pre-feature files │ ├── processed/ # Final feature matrix │ └── external/ # Holidays, events ├── notebooks/ # EDA, modeling, optimization notebooks ├── src/ │ ├── ingestion/ # Data loaders and validators │ ├── features/ # Feature engineering pipeline │ ├── models/ # Train, evaluate, predict │ ├── optimization/ # Allocator and scenario runner │ ├── geospatial/ # GeoJSON builder │ ├── evaluation/ # Metrics and SHAP outputs │ └── pipelines/ # End-to-end orchestration ├── artifacts/ │ ├── models/ # Saved XGBoost + feature list │ ├── metrics/ # Validation results JSON │ ├── maps/ # GeoJSON files │ └── reports/ # Scenario comparison CSVs ├── tests/ # Unit tests per module ├── requirements.txt ├── package.json ├── README.md └── .env # Never commit — template in .env.example

# 14\. API Specification

## 14.1 Internal Application APIs

| Endpoint | Method | Request | Response | Notes |
| --- | --- | --- | --- | --- |
| /health | GET | — | { status: ok, version } | Liveness probe |
| /routes | GET | ?type=City|Express|Feeder|Intercity | Array of route metadata objects | Filterable by type |
| /routes/{route_id} | GET | — | Route + stops + geometry + current overload | Used by map on click |
| /routes/{route_id}/forecast | GET | ?start_date&end_date | Array of { date, predicted_pax, lower_ci, upper_ci } | Confidence intervals required |
| /network/overview | GET | — | KPI summary object | Powers Overview page |
| /network/map | GET | ?overload=true|false | routes.geojson FeatureCollection | Optional overload color properties |
| /network/map/stops | GET | — | stops.geojson FeatureCollection | Separate endpoint for performance |
| /optimization/scenarios | GET | — | List of available scenario configs | — |
| /optimization/run | POST | { budget: 30|60|90, congestion_multiplier: float } | Full scenario result object | Runs solver synchronously |
| /optimization/results/{scenario_id} | GET | — | Cached result for scenario_id | Avoid re-running on every page load |
| /recommendations | GET | ?scenario_id | Ranked corridor table with fleet delta | Linked to optimization result |
| /features/importance | GET | — | Feature importance + SHAP summary data | Powers Forecast Lab explainability panel |
| /analytics/eda | GET | ?metric=growth|seasonal|route_type|congestion | Chart-ready data arrays | Powers Demand Analytics page |

# 15\. Technology Stack

## 15.1 Full Stack (Recommended)

| Layer | Technology | Version | Purpose |
| --- | --- | --- | --- |
| Language | Python | 3.10+ | All data, ML, optimization, API code |
| Data processing | pandas, numpy | 2.x, 1.26+ | Core tabular processing |
| ML | xgboost, scikit-learn | 2.x, 1.4+ | Primary model and baselines |
| Explainability | shap | 0.45+ | SHAP values for feature explanation |
| Visualization (Python) | matplotlib, seaborn, plotly | latest stable | EDA charts and notebook visuals |
| Optimization | scipy, PuLP | latest stable | LP solver and greedy allocator |
| Geospatial | geopandas, shapely, folium | latest stable | GeoJSON generation and route topology |
| API | FastAPI + uvicorn | 0.100+ | REST API layer |
| Frontend | React + TypeScript | 18+, 5+ | Interactive dashboard |
| Map UI | Leaflet.js + React-Leaflet | 1.9+ | Route map rendering |
| Charts | Recharts or Plotly.js | latest stable | Dashboard visualizations |
| Database | SQLite (dev) / PostgreSQL (prod) | — | Store processed results and cached forecasts |
| ML tracking | MLflow (optional) | 2.x | Experiment tracking |
| Testing | pytest (Python) + Vitest (TS) | latest stable | Unit and integration tests |
| Deployment | Render / Railway / Vercel | — | Demo-friendly free-tier hosting |

## 15.2 Minimal Stack (If Time-Constrained)

The following stack produces a credible demo with significantly less setup time:

*   Python notebooks (Jupyter) for all analysis, modeling, and optimization.
*   pandas + xgboost + shap for data and ML.
*   Folium for interactive route maps (renders in notebook or as standalone HTML).
*   Plotly for interactive charts.
*   Streamlit for dashboard (deploy to Streamlit Cloud free tier).
*   CSV files for data persistence — no database required.

# 16\. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
| --- | --- | --- | --- |
| Incorrect relational merge creates phantom route-days | High | Critical — all downstream analytics wrong | Enforce row-count audit after every join; log merge report to artifacts/ |
| Temporal leakage in ML validation | Medium | Critical — inflated metrics mislead evaluation | Enforce time-based split; add assertion: max(train_dates) < min(val_dates) |
| Missing or wrong stop coordinates | Medium | High — routes appear in wrong location on map | Validate lat/long within Dubai bounding box; document approximate routes clearly |
| Missing stop sequence field | Low-Medium | Medium — route topology is approximate | Implement nearest-neighbor fallback; label affected routes as 'approx' |
| Shock-regime underprediction without recalibration | High (if not addressed) | High — forecasts useless for Q3+ period | Implement regime flags and congestion delta features; evaluate separately on shock period |
| Event data noise or missing events | Medium | Medium — feature instability | Use only major events with known dates; test feature on/off with ablation |
| Over-complex scope causes delivery failure | Medium | High | Build must-haves first; never block core on extended features |
| Optimization assumptions too simplistic | Low | Medium — recommendation credibility | State all assumptions explicitly in dashboard and report; run sensitivity on fleet relief rate r |
| Optimization becomes NP-hard at scale | Low (for this dataset) | Low | Route count is bounded; greedy + LP sufficient; OR-Tools available if needed |
| Demo environment has no internet (map tiles fail) | Medium | Medium — map blank in offline demo | Pre-cache map tiles or use offline tile pack; test demo in target environment |

# 17\. Assumptions & Constraints

## 17.1 Explicit Model Assumptions

*   Fleet expansion reduces route overload proportionally (linear fleet relief rate r). This is an approximation — actual relief depends on scheduling and headway adjustments.
*   Route topology (stop sequence and zone classification) does not change during the forecast horizon.
*   Demand elasticity with respect to congestion is stable within the modeled congestion band.
*   Modal substitution (passengers switching from bus to metro/car) is not modeled.
*   The Q3 2025 congestion shock persists through the forecast horizon unless explicitly modeled as reversing.
*   Stop coordinates in Bus\_Stops.csv are accurate and current.

## 17.2 Documented Limitations

*   Extreme congestion escalation beyond Q3 2025 levels is not fully captured by the feature set.
*   Behavioral adaptation (route avoidance due to chronic overcrowding) is excluded.
*   Capacity is approximated proportionally from H1 2025 throughput — not derived from vehicle count × seats × load factor.
*   Fare optimization and infrastructure redesign are explicitly excluded.
*   Weather effects on demand are not modeled in this version.

## 17.3 Project Constraints

*   Deliverable timeline: student/competition project — 4–8 weeks depending on team size.
*   No access to live RTA systems or real-time data feeds.
*   Compute: standard laptop (no GPU required; XGBoost CPU training sufficient for this dataset size).
*   No paid API dependencies required for core functionality.

# 18\. Development Phases & Build Priority

| Phase | Goal | Key Deliverables | Exit Criteria |
| --- | --- | --- | --- |
| Phase 1: Data Foundation | Clean, merged, validated dataset | Merge pipeline, EDA notebook, merge audit report, data dictionary | Row count audit passes; no null Route_IDs after merge |
| Phase 2: Forecasting | Baseline + shock-aware XGBoost model | Baseline models, XGBoost model, validation metrics JSON, SHAP outputs | MAPE < 10% on pre-shock validation; shock model beats baseline on Q3 data |
| Phase 3: Geospatial | Interactive route map | routes.geojson, stops.geojson, critical_corridors.geojson, Folium/Leaflet map | All 6 critical corridors visible; overload coloring works; stop popups functional |
| Phase 4: Optimization | Fleet allocation scenarios | Greedy allocator, LP solver, 30/60/90 scenario results, capital efficiency scores | All 7 scenarios run without error; greedy and LP agree on top-3 routes |
| Phase 5: Productization | API + Dashboard | FastAPI endpoints, React dashboard, all 6 pages functional, end-to-end demo flow | Full demo flow completes in < 5 minutes without errors |
| Phase 6: Polish | Presentation-ready quality | SHAP panel, recommendation export, README, demo script, final presentation | Non-technical judge understands map + recommendation in < 2 minutes |

## 18.1 Absolute Build Priority Order

Build in this order — never start a later item before the earlier one is working:

1.  Clean data pipeline (merge audit passing).
2.  Route map reconstruction (routes visible and correctly located).
3.  Naive baseline forecasting model (minimum benchmark established).
4.  Shock-aware XGBoost model (core ML deliverable).
5.  Overload calculation layer (bridges forecast and optimization).
6.  60-unit optimization scenario (primary recommendation deliverable).
7.  Dashboard integration (all previous outputs wired to UI).
8.  Explainability panel (SHAP visuals).
9.  30 and 90-unit scenarios + stress tests.
10.  Documentation and demo script.

# 19\. Deliverables Checklist

| Deliverable | Type | Location | Required? |
| --- | --- | --- | --- |
| This PRD | Document | docs/PRD.md | Yes |
| Technical Architecture Doc | Document | docs/architecture.md | Yes |
| Data Dictionary | Document | docs/data_dictionary.md | Yes |
| Merge Audit Report | JSON/CSV | artifacts/reports/merge_audit.json | Yes |
| EDA Notebook | Jupyter | notebooks/01_eda.ipynb | Yes |
| Modeling Notebook | Jupyter | notebooks/02_modeling.ipynb | Yes |
| Optimization Notebook | Jupyter | notebooks/03_optimization.ipynb | Yes |
| Geospatial Notebook | Jupyter | notebooks/04_geospatial.ipynb | Yes |
| Processed Feature Matrix | CSV | data/processed/features.csv | Yes |
| GeoJSON Route Files | GeoJSON | artifacts/maps/ | Yes |
| Trained XGBoost Model | JSON | artifacts/models/xgb_final.json | Yes |
| Validation Metrics | JSON | artifacts/metrics/validation_results.json | Yes |
| SHAP Summary Plot | PNG | artifacts/reports/shap_summary.png | Yes |
| Scenario Results CSVs | CSV | artifacts/reports/scenarios/ | Yes |
| FastAPI Backend | Python | app/backend/ | Yes |
| React Frontend Dashboard | TypeScript | app/frontend/ | Yes |
| README with setup instructions | Markdown | README.md | Yes |
| Demo Script | Document | docs/demo_script.md | Yes |
| Final Presentation | Slides | docs/presentation/ | Yes |
| requirements.txt + package.json | Config | root | Yes |

# 20\. Success Criteria

## 20.1 Technical Success

*   Pre-shock MAPE < 10% on time-based validation set.
*   Shock-period model measurably outperforms naive 7-day lag baseline.
*   Out-of-time Q4 2025 MAPE < 15% (evaluated only at final submission).
*   All 6 documented critical corridors (101–105, 112) appear in top overload rankings.
*   Merge audit confirms zero phantom route-days after join pipeline.
*   Optimization solves all 7 scenarios in < 30 seconds.

## 20.2 Product Success

*   User can visually identify where any route runs on the map within 10 seconds.
*   User can view route-level 6-month demand forecast and understand trend direction.
*   User can compare 30, 60, and 90-unit scenarios and explain the trade-offs.
*   User can identify why the top-6 corridors are prioritized (supported by SHAP or feature explanation).
*   Full demo flow (Overview → Map → Forecast → Optimization → Recommendations) completes in under 5 minutes.
*   Non-technical evaluator can interpret the map and recommendation table without being coached.

# 21\. Key Concepts for Team Study

## 21.1 ML & Forecasting

*   Supervised regression vs classification — why this is a regression problem.
*   Time-series feature engineering: lag features, rolling windows, expanding windows.
*   Non-stationarity and regime shifts — what they mean and how to detect them.
*   XGBoost: how gradient boosting works, tree depth, learning rate, early stopping.
*   Time-based validation: why random splits break in time-series forecasting.
*   Error metrics: when to use MAPE vs MAE vs RMSE and what each penalizes.
*   SHAP values: additive feature attribution, beeswarm plots, waterfall plots.
*   Recursive multi-step forecasting: using predicted values as inputs for future predictions.

## 21.2 Optimization

*   Objective function design: min-max vs min-sum — which fits this problem and why.
*   Integer programming constraints: why fleet units must be integers.
*   Greedy algorithms: when they give good-enough solutions vs provably optimal LP.
*   Sensitivity analysis: testing how output changes when assumptions change.
*   Capital efficiency framing: routes stabilized per bus deployed.

## 21.3 Data Engineering

*   Relational join types: left, inner, outer — when each is correct and what goes wrong.
*   Row-count auditing: how to detect silent data corruption from bad merges.
*   Temporal leakage: how future data sneaks into features and how to prevent it.
*   Group-level operations: computing rolling features per Route\_ID group, not globally.

## 21.4 Geospatial

*   GeoJSON format: FeatureCollection, Feature, Point, LineString.
*   Coordinate systems: WGS84 (latitude/longitude) vs projected systems (UTM).
*   Haversine formula: computing distances between GPS coordinates.
*   Leaflet.js basics: tile layers, GeoJSON layers, popups, layer control.

# 22\. Final Recommendation

**Build the shock-aware urban mobility decision system. The strongest version combines route mapping, time-aware demand forecasting, and constrained fleet optimization into a single coherent product — directly aligned with the case mandate.**

The project has three irreducible components that must all work for the product to be compelling:

*   The FORECAST must be shock-aware (not just a pre-shock model applied blindly forward).
*   The MAP must visually reconstruct actual route paths (not just scatter stops).
*   The OPTIMIZATION must respect the fleet budget constraint (not just rank routes by overload).

Build in phases. Phase 1–4 produce a complete analysis system. Phase 5–6 produce a demo-ready product. Even Phase 1–3 alone — a validated shock-aware model with a route map — is a credible deliverable if time is limited.

_End of PRD v2.0 | Dubai Bus Route Optimization Platform_