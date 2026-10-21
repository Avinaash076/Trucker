import type { AnalysisResponse } from './types';

export interface AnalyzeRequest {
  origin: string;
  destination: string;
  departure: string;
  loadWeightLb: number;
  intervalMiles: number;
}

export async function analyzeTrip(payload: AnalyzeRequest): Promise<AnalysisResponse> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || 'The route analysis could not be completed.');
  }
  return body as AnalysisResponse;
}
