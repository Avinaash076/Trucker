# Weather-Aware Truck Routing — Implementation Plan

## Scope

Build a React + Django application that compares three route options for a truck trip. The user enters origin, destination, departure date/time, load weight, and a checkpoint interval. The backend geocodes the trip, obtains or synthesizes three route geometries, samples checkpoint weather at estimated arrival times, applies the assessment risk/load rules, and returns a ranked recommendation. The frontend presents the route comparison, map, checkpoints, risk details, and a 0–48 hour forecast heatmap slider.

## Architecture

- **Frontend:** React + TypeScript + Vite in `src/`. The app owns form state, route selection, map layers, heatmap slider, and responsive presentation.
- **Backend:** Django in `backend/`. `POST /api/analyze` is the single analysis endpoint. `backend/core/services.py` contains geocoding/routing/weather adapters, deterministic demo fallback data, checkpoint interpolation, the risk engine, and recommendation ranking.
- **Map:** Leaflet + OpenStreetMap tiles. Route geometry and checkpoint data come from Django; the React map renders the recommended route with a stronger visual treatment and all alternatives with selectable opacity.
- **Hosting:** A single Django container serves the Vite production build from `frontend-dist/`. The Dockerfile installs Python dependencies, installs/builds Node dependencies, runs the Vite build, and starts Gunicorn on the platform `PORT`.
- **Provider strategy:** The default path is deterministic demo data so the hosted assessment remains usable without secret keys. Optional live adapters use Nominatim for geocoding, OSRM for routing alternatives, and Open-Meteo for hourly weather. Provider failures fall back to the deterministic path and are surfaced as a source note.

## Core logic

1. Normalize and validate input.
2. Geocode origin/destination; use the fallback city catalog/hash geocoder if a provider is unavailable.
3. Generate three geometry variants with distance and duration.
4. Interpolate checkpoints at 10, 25, or 50-mile intervals and estimate ETA from distance / route duration.
5. Retrieve weather at the checkpoint ETA. Evaluate wind, rain, and snow using the exact low/moderate/high/severe/no-travel thresholds.
6. Apply load adjustments: wind ≥55 mph is No Travel for any load; wind 45–54 mph with load >30,000 lb is No Travel; wind 35–44 mph with load >40,000 lb is Severe.
7. Aggregate route risk by miles and checkpoint severity, then sort by severe miles, high miles, average risk, and travel duration.
8. Return map-ready geometry, checkpoint rows, route summaries, and heatmap values for each 0–48-hour slider position.

## Design direction

### Other considered styles

- **Terminal Dispatch / 1990s control room** — 0.06 probability.
- **Clean logistics SaaS / white and blue** — 0.08 probability.
- **Night Navigation Editorial** — 0.07 probability.

### Chosen movement: Night Navigation Editorial

- **Core principles:** operational clarity, calm under pressure, visible evidence, and fast scanning.
- **Color philosophy:** a warm paper canvas reduces glare and makes the safety colors meaningful; ink navy creates command-center authority; acid amber marks decisions and active controls; teal indicates trusted telemetry; risk colors are reserved for weather severity.
- **Layout paradigm:** a wide dispatch console with an offset, dominant map stage and narrow control rail rather than a centered marketing grid. Data cards overlap the map edge like instrument labels.
- **Signature elements:** thin contour-line background texture, route-colored signal dots, and a small “dispatch note” annotation on the recommended route.
- **Interaction philosophy:** inputs feel like dispatch controls; changing interval, route, or forecast hour updates the evidence on the map without hiding context. Route cards are selectable and keep the same ordering while their visual emphasis changes.
- **Animation:** short 180–240ms transitions for route selection and heatmap changes; no looping decoration; map and card changes should feel instrument-like.
- **Typography system:** system sans for body/UI, condensed bold headings via `Arial Narrow` fallback, uppercase micro-labels with letter spacing, and tabular numerals for metrics.
- **Brand essence:** a weather-first co-driver for heavy-haul dispatchers — precise, grounded, decisive. Personality: observant, steady, practical.
- **Brand voice:** headlines state the decision (“Route 02 carries the lowest severe-mile exposure”); CTAs are direct (“Analyze route risk”).
- **Wordmark & logo:** a compact three-node route marker beside the wordmark, suggesting origin, checkpoint, and destination.
- **Signature brand color:** amber `#F3A83B`, used only for active decisions and recommendation emphasis.

## Project structure

```text
truckroute/
├── src/                    # React app, map, route cards, tables, styles
├── public/manus-routes.json
├── backend/
│   ├── config/             # Django settings and URL configuration
│   ├── core/               # API view and route/weather/risk services
│   └── manage.py
├── requirements.txt
├── package.json
├── vite.config.ts
├── Dockerfile
├── app.config.ts
├── .env.example
└── README.md
```
