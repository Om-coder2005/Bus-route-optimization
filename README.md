# Dubai Bus Route Optimization Project

This workspace contains datasets and specifications for a shock-aware bus demand forecasting and fleet optimization platform for Dubai routes.

## Current repository contents

- Core specs:
  - `AGENTS.md`
  - `dubai_bus_prd1.md`
- Datasets:
  - `Bus_Routes.csv`
  - `Bus_Stops.csv`
  - `Route_Stop_Mapping.csv`
  - `Train_Ridership_2022_to_2025H1.csv`
  - `Train_Traffic_2022_to_2025H1.csv`
  - `Shock_Ridership_2025_Q3.csv`
  - `Shock_Traffic_2025_Q3.csv`
  - `OutOfTime_Ridership_2025_Q4.csv`
  - `OutOfTime_Traffic_2025_Q4.csv`

## Build workflow

Use `SKILLS_BUILD_PLAN.md` to follow a phase-by-phase implementation path.

Recommended order:

1. Data pipeline and merge audits
2. Geospatial route reconstruction
3. Forecast baselines and shock-aware model
4. Overload scoring and optimization scenarios
5. FastAPI backend
6. React dashboard

## Critical rules

- Join keys must be correct (`Route_ID`, `Stop_ID`, `Date`).
- `Total_Pax = Boarding_Count + Alighting_Count`.
- No random train/test split.
- Use time-based validation and out-of-time evaluation.

## Suggested next action

Start with a data pipeline module that:

- Validates source schemas
- Produces route-day demand
- Joins traffic and route metadata
- Logs row-count and null audits to artifacts
