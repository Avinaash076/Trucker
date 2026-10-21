import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { AlertTriangle, ArrowRight, CalendarClock, Check, ChevronRight, CircleDot, CloudRain, Gauge, MapPin, Navigation, RefreshCw, Truck, Wind } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { analyzeTrip, type AnalyzeRequest } from './api';
import type { AnalysisResponse, Checkpoint, RiskLevel, RouteOption } from './types';

const routeColors = ['#f3a83b', '#1fa7a2', '#d86f5a'];
const defaultDeparture = new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString().slice(0, 16);
const defaultForm: AnalyzeRequest = {
  origin: 'Denver, CO',
  destination: 'Kansas City, MO',
  departure: defaultDeparture,
  loadWeightLb: 38000,
  intervalMiles: 25,
};

function MapViewport({ routes }: { routes: RouteOption[] }) {
  const map = useMap();
  useEffect(() => {
    const points = routes.flatMap((route) => route.geometry);
    if (points.length) map.fitBounds(points, { padding: [36, 36] });
  }, [map, routes]);
  return null;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder.toString().padStart(2, '0')}m`;
}

function formatEta(value: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
}

function riskClass(level: RiskLevel) {
  return `risk-${level.toLowerCase().replace(' ', '-')}`;
}

function heatColor(intensity: number) {
  if (intensity >= 0.82) return '#d86f5a';
  if (intensity >= 0.62) return '#ed9f52';
  if (intensity >= 0.42) return '#e6c85e';
  if (intensity >= 0.24) return '#6ab8a4';
  return '#4a93a8';
}

function checkpointRiskSummary(checkpoints: Checkpoint[]) {
  const severe = checkpoints.filter((point) => point.riskLevel === 'Severe' || point.riskLevel === 'No Travel').length;
  const high = checkpoints.filter((point) => point.riskLevel === 'High').length;
  return { severe, high };
}

export default function App() {
  const [form, setForm] = useState<AnalyzeRequest>(defaultForm);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState('route-1');
  const [forecastHour, setForecastHour] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedRoute = useMemo(() => analysis?.routes.find((route) => route.id === selectedRouteId) ?? analysis?.routes[0], [analysis, selectedRouteId]);
  const recommendedRoute = useMemo(() => analysis?.routes.find((route) => route.isRecommended), [analysis]);

  async function submit(nextForm = form) {
    setLoading(true);
    setError('');
    try {
      const result = await analyzeTrip(nextForm);
      setAnalysis(result);
      setSelectedRouteId(result.recommendedRouteId);
      setForecastHour(0);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to analyze this trip.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void submit(defaultForm);
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  function updateField<K extends keyof AnalyzeRequest>(key: K, value: AnalyzeRequest[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="route-mark" aria-hidden="true"><i /><i /><i /></div>
          <div>
            <div className="brand-name">ROUTE WEATHER</div>
            <div className="brand-kicker">heavy-haul risk console</div>
          </div>
        </div>
        <div className="topbar-status"><span className="status-dot" /> forecast corridor online <span className="status-divider" /> 06:42 UTC</div>
      </header>

      <section className="hero-row">
        <div>
          <p className="eyebrow"><span className="eyebrow-line" /> DISPATCH / TRIP ASSESSMENT</p>
          <h1>Choose the safer<br /><em>line through weather.</em></h1>
          <p className="hero-copy">Three corridors. Time-aligned weather. A route recommendation that shows its work.</p>
        </div>
        <div className="hero-callout">
          <div className="callout-number">01</div>
          <div><strong>Decision order</strong><span>severe miles → high miles → average risk → travel time</span></div>
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="control-rail">
          <div className="panel-heading">
            <div><p className="eyebrow">TRIP SETUP</p><h2>Build a trip</h2></div>
            <Navigation size={19} strokeWidth={1.8} />
          </div>
          <form className="trip-form" onSubmit={handleSubmit}>
            <label className="field-label">ORIGIN<span>required</span><div className="field-wrap"><MapPin size={16} /><input value={form.origin} onChange={(event) => updateField('origin', event.target.value)} placeholder="City, state or address" /></div></label>
            <label className="field-label">DESTINATION<span>required</span><div className="field-wrap"><MapPin size={16} /><input value={form.destination} onChange={(event) => updateField('destination', event.target.value)} placeholder="City, state or address" /></div></label>
            <div className="field-pair">
              <label className="field-label">DEPARTURE<div className="field-wrap"><CalendarClock size={16} /><input type="datetime-local" value={form.departure} onChange={(event) => updateField('departure', event.target.value)} /></div></label>
              <label className="field-label">LOAD / LB<div className="field-wrap"><Truck size={16} /><input type="number" min="0" step="500" value={form.loadWeightLb} onChange={(event) => updateField('loadWeightLb', Number(event.target.value))} /></div></label>
            </div>
            <label className="field-label">CHECKPOINT CADENCE<span>sample weather every</span><select value={form.intervalMiles} onChange={(event) => updateField('intervalMiles', Number(event.target.value))}><option value={10}>10 miles</option><option value={25}>25 miles</option><option value={50}>50 miles</option></select></label>
            <button className="primary-button" disabled={loading} type="submit">{loading ? <><RefreshCw size={16} className="spin" /> calculating corridors</> : <>Analyze route risk <ArrowRight size={16} /></>}</button>
          </form>
          <div className="rules-card">
            <div className="rules-title"><Gauge size={16} /> RISK MODEL</div>
            <p><strong>Wind ≥55 mph</strong> is No Travel for every load. At 45–54 mph, loads over 30,000 lb are No Travel.</p>
            <p>At 35–44 mph, loads over 40,000 lb escalate to Severe.</p>
          </div>
          <div className="legend-list"><div><span className="legend-swatch low" /> low</div><div><span className="legend-swatch moderate" /> moderate</div><div><span className="legend-swatch high" /> high</div><div><span className="legend-swatch severe" /> severe</div></div>
        </aside>

        <section className="main-stage">
          {error && <div className="error-banner"><AlertTriangle size={17} /> {error}</div>}
          <div className="map-card">
            <div className="map-toolbar">
              <div><p className="eyebrow">LIVE CORRIDOR VIEW</p><h2>{analysis ? `${analysis.request.origin} → ${analysis.request.destination}` : 'Loading trip corridor'}</h2></div>
              <div className="map-toolbar-right"><span className="map-chip"><span className="status-dot" /> {analysis?.source === 'demo' ? 'demo forecast' : 'provider forecast'}</span><span className="map-chip">{analysis?.request.intervalMiles ?? 25} mi cadence</span></div>
            </div>
            <div className="map-frame">
              {analysis ? <MapContainer className="leaflet-map" center={[39, -98]} zoom={5} scrollWheelZoom zoomControl={false}>
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.de/{z}/{x}/{y}.png" />
                <MapViewport routes={analysis.routes} />
                {analysis.routes.map((route, routeIndex) => <Polyline key={route.id} positions={route.geometry} pathOptions={{ color: routeColors[routeIndex], weight: route.id === selectedRoute?.id ? 6 : route.isRecommended ? 5 : 3, opacity: route.id === selectedRoute?.id ? 1 : route.isRecommended ? 0.88 : 0.4, dashArray: route.id === selectedRoute?.id ? undefined : '8 8' }} />)}
                {analysis.routes.flatMap((route, routeIndex) => route.checkpoints.map((checkpoint) => <CircleMarker key={checkpoint.id} center={[checkpoint.lat, checkpoint.lng]} radius={route.id === selectedRoute?.id ? 7 : 4} pathOptions={{ color: routeColors[routeIndex], weight: 2, fillColor: heatColor(checkpoint.riskScore / 5), fillOpacity: route.id === selectedRoute?.id ? 0.95 : 0.45 }}><Popup><div className="popup-card"><strong>{route.name} / mile {checkpoint.mile}</strong><span>{formatEta(checkpoint.eta)}</span><b className={riskClass(checkpoint.riskLevel)}>{checkpoint.riskLevel}</b><small>Wind {checkpoint.weather.windMph} mph · Rain {checkpoint.weather.rainInHr.toFixed(2)} in/hr</small></div></Popup></CircleMarker>))}
                {analysis.heatmap.map((point, index) => <CircleMarker key={`heat-${index}`} center={[point.lat, point.lng]} radius={10 + point.riskByHour[forecastHour] * 9} pathOptions={{ stroke: false, fillColor: heatColor(point.riskByHour[forecastHour]), fillOpacity: 0.14 }} />)}
              </MapContainer> : <div className="map-loading"><RefreshCw className="spin" /> Building corridor model…</div>}
              <div className="map-annotation"><CircleDot size={15} /><span><strong>{recommendedRoute?.name ?? '—'} recommended</strong><small>{recommendedRoute?.summary.severeMiles ?? 0} severe miles · {recommendedRoute ? formatDuration(recommendedRoute.summary.durationMinutes) : '—'}</small></span></div>
              <div className="heatmap-slider"><div className="slider-label"><span><CloudRain size={15} /> WEATHER HEATMAP</span><strong>+{forecastHour}h forecast</strong></div><input aria-label="Forecast hour" type="range" min="0" max="48" value={forecastHour} onChange={(event) => setForecastHour(Number(event.target.value))} /><div className="slider-scale"><span>now</span><span>12h</span><span>24h</span><span>36h</span><span>48h</span></div></div>
            </div>
          </div>

          <div className="section-heading"><div><p className="eyebrow">ROUTE COMPARISON</p><h2>Three ways forward</h2></div><span className="section-note">ranked by safety first</span></div>
          <div className="route-grid">
            {analysis?.routes.map((route, routeIndex) => {
              const checkpointRisk = checkpointRiskSummary(route.checkpoints);
              return <button type="button" className={`route-card ${route.id === selectedRoute?.id ? 'selected' : ''} ${route.isRecommended ? 'recommended' : ''}`} key={route.id} onClick={() => setSelectedRouteId(route.id)}>
                <div className="route-card-top"><span className="route-color" style={{ backgroundColor: routeColors[routeIndex] }} /><div><div className="route-name">{route.name} {route.isRecommended && <span className="recommended-tag"><Check size={11} /> recommended</span>}</div><div className="route-label">{route.label}</div></div><ChevronRight size={17} /></div>
                <div className="route-metrics"><div><span>distance</span><strong>{formatNumber(route.summary.distanceMiles)} <small>mi</small></strong></div><div><span>drive time</span><strong>{formatDuration(route.summary.durationMinutes)}</strong></div><div><span>avg risk</span><strong>{route.summary.averageRisk.toFixed(2)}<small>/5</small></strong></div></div>
                <div className="route-risk-row"><span className="mini-risk severe-dot" /> {route.summary.severeMiles} severe mi <span className="mini-risk high-dot" /> {route.summary.highMiles} high mi {route.summary.noTravelCount > 0 && <b className="no-travel-copy">{route.summary.noTravelCount} no-travel checkpoints</b>}</div>
                <div className="route-card-footer"><span>{checkpointRisk.severe} elevated checkpoints</span><span className="route-select-hint">{route.id === selectedRoute?.id ? 'inspecting' : 'inspect route'}</span></div>
              </button>;
            })}
          </div>

          <div className="detail-grid">
            <section className="detail-card checkpoint-card"><div className="detail-card-heading"><div><p className="eyebrow">CHECKPOINT WEATHER</p><h2>{selectedRoute?.name ?? 'Selected route'}</h2></div><span className="detail-count">{selectedRoute?.checkpoints.length ?? 0} points</span></div><div className="table-wrap"><table><thead><tr><th>mile</th><th>estimated arrival</th><th>wind</th><th>rain</th><th>snow</th><th>risk</th></tr></thead><tbody>{selectedRoute?.checkpoints.map((checkpoint) => <tr key={checkpoint.id}><td className="mono">{checkpoint.mile}</td><td>{formatEta(checkpoint.eta)}</td><td>{checkpoint.weather.windMph} mph</td><td>{checkpoint.weather.rainInHr.toFixed(2)} in/hr</td><td>{checkpoint.weather.snowInHr.toFixed(2)} in/hr</td><td><span className={`risk-pill ${riskClass(checkpoint.riskLevel)}`}>{checkpoint.riskLevel}</span></td></tr>)}</tbody></table></div></section>
            <aside className="detail-card dispatch-card"><div className="detail-card-heading"><div><p className="eyebrow">DISPATCH NOTE</p><h2>Why this route</h2></div><Wind size={19} /></div>{recommendedRoute && <><div className="dispatch-verdict"><div className="verdict-icon"><Check size={20} /></div><div><strong>{recommendedRoute.name} carries the lowest exposure.</strong><span>{recommendedRoute.recommendationReason}</span></div></div><div className="decision-stack"><div><span>SEVERE MILES</span><strong>{recommendedRoute.summary.severeMiles}</strong></div><div><span>HIGH MILES</span><strong>{recommendedRoute.summary.highMiles}</strong></div><div><span>NO-TRAVEL FLAGS</span><strong>{recommendedRoute.summary.noTravelCount}</strong></div></div></>}{analysis && <p className="source-note">{analysis.sourceNote}</p>}</aside>
          </div>
        </section>
      </section>
      <footer className="footer-note"><span>ROUTE WEATHER / ASSESSMENT BUILD</span><span>weather aligned to estimated checkpoint arrival · risk model v1.0</span></footer>
    </main>
  );
}
