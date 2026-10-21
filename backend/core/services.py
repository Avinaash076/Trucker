from __future__ import annotations

import hashlib
import math
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import requests


CITY_CATALOG = {
    'denver': (39.7392, -104.9903),
    'kansas city': (39.0997, -94.5786),
    'chicago': (41.8781, -87.6298),
    'dallas': (32.7767, -96.7970),
    'san francisco': (37.7749, -122.4194),
    'los angeles': (34.0522, -118.2437),
    'seattle': (47.6062, -122.3321),
    'portland': (45.5152, -122.6784),
    'phoenix': (33.4484, -112.0740),
    'new york': (40.7128, -74.0060),
    'atlanta': (33.7490, -84.3880),
    'minneapolis': (44.9778, -93.2650),
    'salt lake city': (40.7608, -111.8910),
    'las vegas': (36.1699, -115.1398),
    'houston': (29.7604, -95.3698),
}

RISK_SCORE = {'Low': 1, 'Moderate': 2, 'High': 3, 'Severe': 4, 'No Travel': 5}
RISK_ORDER = ['Low', 'Moderate', 'High', 'Severe', 'No Travel']


def haversine_miles(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 3958.8 * 2 * math.asin(math.sqrt(h))


def parse_departure(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


def demo_geocode(query: str) -> tuple[float, float]:
    normalized = query.strip().lower()
    for name, point in CITY_CATALOG.items():
        if name in normalized:
            return point
    digest = hashlib.sha256(normalized.encode('utf-8')).digest()
    lat = 28.0 + (digest[0] / 255) * 20.0
    lng = -122.0 + (digest[1] / 255) * 48.0
    return round(lat, 5), round(lng, 5)


def geocode(query: str) -> tuple[tuple[float, float], str]:
    use_live = os.getenv('ROUTE_USE_LIVE', 'false').lower() == 'true'
    if use_live:
        try:
            response = requests.get(
                'https://nominatim.openstreetmap.org/search',
                params={'q': query, 'format': 'jsonv2', 'limit': 1},
                headers={'User-Agent': 'route-weather-assessment/1.0'},
                timeout=6,
            )
            response.raise_for_status()
            result = response.json()[0]
            return (float(result['lat']), float(result['lon'])), 'live'
        except (requests.RequestException, IndexError, KeyError, ValueError):
            pass
    return demo_geocode(query), 'demo'


def make_geometry(start: tuple[float, float], end: tuple[float, float], variant: int) -> list[tuple[float, float]]:
    start_lat, start_lng = start
    end_lat, end_lng = end
    dx = end_lng - start_lng
    dy = end_lat - start_lat
    length = max(math.sqrt(dx * dx + dy * dy), 0.01)
    perp_lat = -dx / length
    perp_lng = dy / length
    offsets = [0.0, 0.85, -1.05]
    offset = offsets[variant]
    points: list[tuple[float, float]] = []
    for index in range(17):
        t = index / 16
        bow = math.sin(math.pi * t) * offset
        lat = start_lat + (end_lat - start_lat) * t + perp_lat * bow
        lng = start_lng + (end_lng - start_lng) * t + perp_lng * bow
        points.append((round(lat, 5), round(lng, 5)))
    return points


def route_distance(geometry: list[tuple[float, float]]) -> float:
    return sum(haversine_miles(geometry[i - 1], geometry[i]) for i in range(1, len(geometry)))


def route_duration(distance: float, variant: int) -> int:
    average_speed = [54, 51, 49][variant]
    delay = [24, 36, 52][variant]
    return round(distance / average_speed * 60 + delay)


def classify_threshold(value: float, low: float, moderate: float, high: float, severe: float, no_travel: float | None = None) -> str:
    if no_travel is not None and value > no_travel:
        return 'No Travel'
    if value >= severe:
        return 'Severe'
    if value >= high:
        return 'High'
    if value >= moderate:
        return 'Moderate'
    return 'Low'


def classify_weather(weather: dict[str, float], load_weight: float) -> tuple[str, str, float]:
    wind_level = classify_threshold(weather['windMph'], 0, 25, 35, 45, 55)
    rain_level = classify_threshold(weather['rainInHr'], 0, 0.10, 0.25, 0.50, 1.00)
    snow_level = classify_threshold(weather['snowInHr'], 0, 0.5, 1.0, 2.0, 3.0)
    levels = {'Wind': wind_level, 'Rain': rain_level, 'Snow': snow_level}
    highest = max(levels.values(), key=lambda item: RISK_SCORE[item])
    reasons = [f'{name} {weather_key(weather, name)} → {level}' for name, level in levels.items() if level == highest]

    if weather['windMph'] >= 55:
        highest = 'No Travel'
        reasons = ['Wind ≥55 mph → No Travel for any load']
    elif 45 <= weather['windMph'] < 55 and load_weight > 30000:
        highest = 'No Travel'
        reasons = [f'Wind {weather["windMph"]:.0f} mph + load >30,000 lb → No Travel']
    elif 35 <= weather['windMph'] < 45 and load_weight > 40000 and RISK_SCORE[highest] < RISK_SCORE['Severe']:
        highest = 'Severe'
        reasons = [f'Wind {weather["windMph"]:.0f} mph + load >40,000 lb → Severe']

    return highest, '; '.join(reasons), float(RISK_SCORE[highest])


def weather_key(weather: dict[str, float], name: str) -> str:
    return {
        'Wind': f'{weather["windMph"]:.0f} mph',
        'Rain': f'{weather["rainInHr"]:.2f} in/hr',
        'Snow': f'{weather["snowInHr"]:.2f} in/hr',
    }[name]


def demo_weather(route_index: int, mile: float, total_distance: float, forecast_hour: int = 0) -> dict[str, float]:
    progress = mile / max(total_distance, 1)
    storm = math.exp(-((progress - (0.48 + route_index * 0.07)) / 0.22) ** 2)
    phase = forecast_hour / 7.5
    wind = [22, 28, 34][route_index] + [11, 22, 30][route_index] * storm + 2.2 * math.sin(progress * 11 + phase)
    rain = [0.04, 0.10, 0.18][route_index] + [0.10, 0.32, 0.56][route_index] * storm + 0.018 * max(0, math.sin(progress * 8 + phase))
    snow = [0.02, 0.10, 0.20][route_index] + [0.08, 0.25, 0.48][route_index] * storm
    return {'windMph': round(max(0, wind), 1), 'rainInHr': round(max(0, rain), 3), 'snowInHr': round(max(0, snow), 3)}


def live_weather(lat: float, lng: float, eta: datetime) -> dict[str, float] | None:
    try:
        response = requests.get(
            'https://api.open-meteo.com/v1/forecast',
            params={
                'latitude': lat,
                'longitude': lng,
                'hourly': 'wind_speed_10m,rain,snowfall',
                'wind_speed_unit': 'mph',
                'precipitation_unit': 'inch',
                'forecast_days': 3,
                'timezone': 'UTC',
            },
            timeout=8,
        )
        response.raise_for_status()
        payload = response.json()
        times = payload['hourly']['time']
        target = eta.replace(minute=0, second=0, microsecond=0).isoformat().replace('+00:00', 'Z')
        index = min(range(len(times)), key=lambda i: abs(datetime.fromisoformat(times[i].replace('Z', '+00:00')) - eta))
        return {
            'windMph': float(payload['hourly']['wind_speed_10m'][index]),
            'rainInHr': float(payload['hourly']['rain'][index]),
            'snowInHr': float(payload['hourly']['snowfall'][index]),
        }
    except (requests.RequestException, KeyError, IndexError, ValueError, TypeError):
        return None


def checkpoint_points(geometry: list[tuple[float, float]], distance: float, interval: int) -> list[tuple[float, tuple[float, float]]]:
    count = max(1, math.ceil(distance / interval))
    points: list[tuple[float, tuple[float, float]]] = []
    for index in range(1, count + 1):
        mile = min(index * interval, distance)
        t = mile / max(distance, 1)
        position = t * (len(geometry) - 1)
        lower = min(int(position), len(geometry) - 2)
        fraction = position - lower
        a, b = geometry[lower], geometry[lower + 1]
        point = (a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction)
        points.append((round(mile, 1), (round(point[0], 5), round(point[1], 5))))
    return points


def live_route_geometries(start: tuple[float, float], end: tuple[float, float]) -> list[list[tuple[float, float]]]:
    try:
        response = requests.get(
            f'https://router.project-osrm.org/route/v1/driving/{start[1]},{start[0]};{end[1]},{end[0]}',
            params={'alternatives': 'true', 'overview': 'full', 'geometries': 'geojson'},
            timeout=10,
        )
        response.raise_for_status()
        routes = response.json().get('routes', [])
        geometries = []
        for route in routes[:3]:
            coordinates = route['geometry']['coordinates']
            geometries.append([(round(lat, 5), round(lng, 5)) for lng, lat in coordinates])
        return geometries
    except (requests.RequestException, KeyError, TypeError, ValueError):
        return []


def analyze_trip(payload: dict[str, Any]) -> dict[str, Any]:
    origin = str(payload.get('origin', '')).strip()
    destination = str(payload.get('destination', '')).strip()
    load_weight = float(payload.get('loadWeightLb', 0))
    interval = int(payload.get('intervalMiles', 25))
    departure = parse_departure(str(payload.get('departure', '')))
    if not origin or not destination:
        raise ValueError('Origin and destination are required.')
    if load_weight < 0:
        raise ValueError('Load weight must be zero or greater.')
    if interval not in (10, 25, 50):
        raise ValueError('Checkpoint interval must be 10, 25, or 50 miles.')

    (start, origin_source) = geocode(origin)
    (end, destination_source) = geocode(destination)
    live_geometries = live_route_geometries(start, end) if os.getenv('ROUTE_USE_LIVE', 'false').lower() == 'true' else []
    geometries = live_geometries[:]
    while len(geometries) < 3:
        geometries.append(make_geometry(start, end, len(geometries)))
    geometries = geometries[:3]
    source = 'live' if origin_source == destination_source == 'live' and len(live_geometries) >= 3 else 'mixed' if origin_source == 'live' or destination_source == 'live' else 'demo'

    routes: list[dict[str, Any]] = []
    for route_index, geometry in enumerate(geometries):
        distance = route_distance(geometry)
        duration = route_duration(distance, route_index)
        checkpoints = []
        severe_miles = 0.0
        high_miles = 0.0
        risk_total = 0.0
        no_travel_count = 0
        checkpoint_list = checkpoint_points(geometry, distance, interval)
        previous_mile = 0.0
        for checkpoint_index, (mile, point) in enumerate(checkpoint_list):
            eta = departure + timedelta(minutes=duration * (mile / max(distance, 1)))
            weather = live_weather(point[0], point[1], eta) if os.getenv('ROUTE_USE_LIVE', 'false').lower() == 'true' else None
            weather_source = 'open-meteo' if weather else 'demo'
            weather = weather or demo_weather(route_index, mile, distance)
            risk_level, reason, risk_score = classify_weather(weather, load_weight)
            segment_miles = max(mile - previous_mile, 0)
            previous_mile = mile
            if risk_level == 'Severe':
                severe_miles += segment_miles
            if risk_level == 'High':
                high_miles += segment_miles
            if risk_level == 'No Travel':
                no_travel_count += 1
            risk_total += risk_score
            checkpoints.append({
                'id': f'r{route_index + 1}-cp{checkpoint_index + 1}',
                'mile': mile,
                'lat': point[0],
                'lng': point[1],
                'eta': iso(eta),
                'weather': {**weather, 'source': weather_source},
                'riskLevel': risk_level,
                'riskScore': risk_score,
                'riskReason': reason,
            })
        average_risk = risk_total / max(len(checkpoints), 1)
        routes.append({
            'id': f'route-{route_index + 1}',
            'name': f'Route {route_index + 1:02d}',
            'label': ['Northern shoulder', 'Balanced corridor', 'Southern weather detour'][route_index],
            'geometry': [[lat, lng] for lat, lng in geometry],
            'summary': {
                'severeMiles': round(severe_miles, 1),
                'highMiles': round(high_miles, 1),
                'averageRisk': round(average_risk, 2),
                'noTravelCount': no_travel_count,
                'durationMinutes': duration,
                'distanceMiles': round(distance, 1),
            },
            'checkpoints': checkpoints,
            'recommendationReason': '',
            'isRecommended': False,
        })

    ranked = sorted(routes, key=lambda route: (
        route['summary']['severeMiles'],
        route['summary']['highMiles'],
        route['summary']['averageRisk'],
        route['summary']['durationMinutes'],
    ))
    recommended_id = ranked[0]['id']
    for route in routes:
        route['isRecommended'] = route['id'] == recommended_id
        if route['isRecommended']:
            route['recommendationReason'] = 'Best on the required priority order: severe miles, high miles, average risk, then travel time.'
        else:
            route['recommendationReason'] = 'Kept as an alternative for driver review; it trails the recommended route on the priority order.'

    heatmap: list[dict[str, Any]] = []
    for route_index, route in enumerate(routes):
        geometry = route['geometry']
        for point_index in range(0, len(geometry), 2):
            lat, lng = geometry[point_index]
            progress = point_index / max(len(geometry) - 1, 1)
            base_mile = route['summary']['distanceMiles'] * progress
            risk_by_hour = []
            for hour in range(49):
                weather = demo_weather(route_index, base_mile, route['summary']['distanceMiles'], hour)
                level, _, score = classify_weather(weather, load_weight)
                risk_by_hour.append(round(score / 5, 3))
            heatmap.append({'lat': lat, 'lng': lng, 'riskByHour': risk_by_hour})

    return {
        'request': {
            'origin': origin,
            'destination': destination,
            'departure': iso(departure),
            'loadWeightLb': load_weight,
            'intervalMiles': interval,
        },
        'routes': routes,
        'recommendedRouteId': recommended_id,
        'heatmap': heatmap,
        'source': source,
        'sourceNote': 'Demo weather/routing data keeps this assessment runnable without provider keys. Set ROUTE_USE_LIVE=true to use Nominatim, OSRM, and Open-Meteo adapters; any provider failure falls back safely.',
    }
