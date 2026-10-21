# Route Weather — Weather-Aware Truck Routing

Route Weather is a full-stack React + Django assessment build for choosing the safest truck route from weather, load weight, and travel time. The app compares three route corridors, aligns checkpoint forecasts to estimated arrival times, applies the requested thresholds, and makes the recommendation auditable in the UI.

## What is included

The React dashboard includes trip inputs, three selectable route cards, a Leaflet map with all route geometries and checkpoints, checkpoint popups, a recommended-route dispatch note, and a 0–48 hour heatmap slider. The Django API returns route geometry, distance, duration, time-aligned checkpoint weather, risk reasons, route aggregates, and heatmap intensity arrays.

The default hosted/local mode is deterministic demo data. This keeps the app usable without provider keys and makes the risk model easy to test. Optional live adapters are included for Nominatim geocoding, OSRM routing alternatives, and Open-Meteo hourly weather. Set `ROUTE_USE_LIVE=true` to enable them; a provider failure falls back to demo data instead of breaking the trip analysis.

## Local setup

```bash
npm install
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm run build
python backend/manage.py runserver 0.0.0.0:8000
```

For a live frontend during development, run Vite in a second terminal with `npm run dev` and open the Vite URL. The Vite proxy sends `/api` calls to Django on port 8000. For a production-like local run, build first and use the container command below.

The app does not require a database for route analysis. SQLite is present only so Django can run its standard migration lifecycle. Copy `.env.example` to `.env` if you want to enable live providers.

## Risk model

Wind is Low below 25 mph, Moderate at 25–34, High at 35–44, Severe at 45–54, and No Travel at 55 mph or greater. Rain is Low below 0.10 in/hr, Moderate at 0.10–0.25, High at 0.25–0.50, Severe at 0.50–1.00, and No Travel above 1.00. Snow follows the supplied 0.5 / 1.0 / 2.0 / 3.0 in/hr bands.

The highest condition risk is used at each checkpoint. Load adjustments then apply exactly: wind ≥55 mph is No Travel for any load; wind 45–54 mph with a load over 30,000 lb is No Travel; wind 35–44 mph with a load over 40,000 lb is Severe. Route ranking sorts by severe miles, high miles, average risk score, and travel duration in that order.

## API

`POST /api/analyze` accepts JSON with `origin`, `destination`, `departure` (ISO date/time), `loadWeightLb`, and `intervalMiles` (10, 25, or 50). `GET /api/health` returns a simple readiness response. The API is intentionally stateless, so the hosted container can scale horizontally.

## Tests and checks

```bash
npm run typecheck
npm run build
python -m compileall backend
curl http://127.0.0.1:8000/api/health
```

To test the load rules in the UI, use a 38,000 lb load to see the 45–54 mph rule escalate a checkpoint to No Travel. Use a load above 40,000 lb to exercise the 35–44 mph Severe adjustment. The route checkpoint popups and dispatch note show the rule explanation returned by Django.

## Hosting

This repository is configured as a Django container deployment. The Dockerfile builds the Vite frontend in a Node stage, installs Django/Gunicorn/requests in a Python stage, serves the built frontend from Django, and listens on the platform-provided `PORT` (3000 by default). Configure the project deployment with `healthPath: /api/health`, build the image from the checkpoint, and publish.

For a conventional Docker host:

```bash
docker build -t route-weather .
docker run --rm -p 3000:3000 -e DJANGO_SECRET_KEY='change-me' route-weather
```

If you want live providers on the hosted app, set `ROUTE_USE_LIVE=true` as a runtime environment variable. Nominatim and OSRM are public services with usage policies; for production traffic, swap the adapter URLs for your approved geocoder/router and keep the weather adapter server-side.

## Walkthrough outline

A 5–10 minute walkthrough can show: entering a trip and load; comparing the three route cards; opening a checkpoint popup; moving the forecast slider; inspecting the selected-route table; and changing the load above 40,000 lb to demonstrate the load-aware risk adjustment. Finish with the risk ranking and deployment configuration.
