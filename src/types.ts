export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Severe' | 'No Travel';

export interface WeatherReading {
  windMph: number;
  rainInHr: number;
  snowInHr: number;
  source: 'demo' | 'open-meteo';
}

export interface Checkpoint {
  id: string;
  mile: number;
  lat: number;
  lng: number;
  eta: string;
  weather: WeatherReading;
  riskLevel: RiskLevel;
  riskScore: number;
  riskReason: string;
}

export interface RouteSummary {
  severeMiles: number;
  highMiles: number;
  averageRisk: number;
  noTravelCount: number;
  durationMinutes: number;
  distanceMiles: number;
}

export interface RouteOption {
  id: string;
  name: string;
  label: string;
  geometry: [number, number][];
  summary: RouteSummary;
  checkpoints: Checkpoint[];
  recommendationReason: string;
  isRecommended: boolean;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  riskByHour: number[];
}

export interface AnalysisResponse {
  request: {
    origin: string;
    destination: string;
    departure: string;
    loadWeightLb: number;
    intervalMiles: number;
  };
  routes: RouteOption[];
  recommendedRouteId: string;
  heatmap: HeatmapPoint[];
  source: 'demo' | 'live' | 'mixed';
  sourceNote: string;
}
