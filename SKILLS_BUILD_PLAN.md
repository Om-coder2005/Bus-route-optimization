# Skills Build Plan

This file maps the project requirements to the most relevant implementation skills and execution order.

## Primary skills to use

- `ml-pipeline-workflow`
- `project-development`
- `backend-development-feature-development`
- `fastapi-pro`
- `frontend-developer`

## Supporting skills (recommended)

- `python-pro` (core Python quality and patterns)
- `testing-qa` (test strategy and automation)
- `performance-optimizer` (optimize model + API + UI paths)
- `observability-engineer` (metrics, health, monitoring)
- `documentation` (deliverable and handoff quality)

## Phase-aligned skill routing

### Phase 1: Data foundation

- Lead: `ml-pipeline-workflow`
- Support: `project-development`, `python-pro`
- Output:
  - Route-day dataset with strict join integrity
  - Merge audits
  - Feature-ready table

### Phase 2: Forecasting

- Lead: `ml-pipeline-workflow`
- Support: `python-pro`, `testing-qa`
- Output:
  - Naive baseline
  - Linear baseline
  - Shock-aware XGBoost
  - Time-based validation metrics (MAPE, MAE, RMSE)

### Phase 3: Geospatial mapping

- Lead: `project-development`
- Support: `frontend-developer`, `python-pro`
- Output:
  - Route geometry reconstruction
  - `routes.geojson`, `stops.geojson`
  - Critical corridor overlays

### Phase 4: Overload + optimization

- Lead: `ml-pipeline-workflow`
- Support: `project-development`
- Output:
  - Overload scoring
  - 30/60/90 fleet scenarios
  - Sensitivity outputs

### Phase 5: Backend API

- Lead: `fastapi-pro`
- Support: `backend-development-feature-development`, `testing-qa`
- Output:
  - FastAPI service with endpoints from PRD
  - Pydantic schemas
  - Health, metrics, and scenario execution endpoints

### Phase 6: Frontend dashboard

- Lead: `frontend-developer`
- Support: `project-development`
- Output:
  - Overview, map, forecast, optimization, recommendations pages
  - API integration and route interactions

### Phase 7: Integration, quality, and demo

- Lead: `backend-development-feature-development`
- Support: `performance-optimizer`, `observability-engineer`, `documentation`
- Output:
  - End-to-end tested flow
  - Demo script and project docs
  - Performance checks and risk controls

## Non-negotiable controls (from project docs)

- Use `Route_ID`, `Stop_ID`, and `Date` correctly in joins.
- Compute `Total_Pax = Boarding_Count + Alighting_Count`.
- No random split; only time-based validation.
- Preserve route topology for mapping.
- Include route map, forecasting, overload scoring, and optimization.

## Immediate next implementation steps

1. Create folder structure in PRD.
2. Implement data ingestion + validation pipeline first.
3. Produce and verify a route-day dataset artifact.
4. Build and evaluate naive + linear baselines.
5. Train shock-aware XGBoost with strict OOT holdout.
6. Expose outputs via FastAPI and connect dashboard.
