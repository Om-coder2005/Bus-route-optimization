**# AGENTS.md**



\## Project

Dubai Bus Route Optimization and Demand Forecasting Platform.



\## Goal

Build an end-to-end ML and decision-support system that:

1\. Maps routes and stops on Dubai geography.

2\. Forecasts route-level daily demand.

3\. Detects overload corridors.

4\. Optimizes fleet allocation under constraints.

5\. Presents recommendations in a dashboard.



\## Core datasets

\- Bus\_Routes.csv

\- Bus\_Stops.csv

\- Route\_Stop\_Mapping.csv

\- Train\_Ridership\_2022\_to\_2025H1.csv

\- Train\_Traffic\_2022\_to\_2025H1.csv

\- External holiday/event files



\## Non-negotiables

\- Use Route\_ID, Stop\_ID, Date correctly in joins.

\- Compute Total\_Pax = Boarding\_Count + Alighting\_Count.

\- No random train/test split.

\- Use time-based validation and out-of-time evaluation.

\- Preserve route topology for mapping.

\- Include route map, forecasting, overload scoring, and optimization.



\## MVP priority

1\. Data pipeline

2\. Geospatial route map

3\. Baseline forecasting

4\. Shock-aware XGBoost

5\. Overload calculation

6\. 60-unit optimization scenario

7\. Dashboard integration



\## Modeling guidance

\- Build naive baseline, linear baseline, and XGBoost.

\- Include temporal, lag, congestion, zone, network-share, holiday, and event features.

\- Evaluate using MAPE, MAE, RMSE.

\- Add explainability.



\## Optimization guidance

\- Use baseline capacity from H1 2025 throughput.

\- Minimize maximum route overload under fleet budget.

\- Support 30, 60, 90 unit scenarios.



\## Build philosophy

Prefer a small number of complete, working features over many partial ones.

Every module must be testable independently.

