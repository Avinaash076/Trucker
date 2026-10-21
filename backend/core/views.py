import json
import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .services import analyze_trip


def health(request: HttpRequest) -> JsonResponse:
    return JsonResponse({'status': 'ok', 'service': 'route-weather'})


@csrf_exempt
def analyze(request: HttpRequest) -> JsonResponse:
    if request.method != 'POST':
        return JsonResponse({'error': 'Use POST for route analysis.'}, status=405)
    try:
        payload = json.loads(request.body or '{}')
        result = analyze_trip(payload)
        return JsonResponse(result)
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        return JsonResponse({'error': str(exc)}, status=400)
    except Exception:
        return JsonResponse({'error': 'Route analysis failed unexpectedly. Check provider settings or retry with demo mode.'}, status=500)


def frontend(request: HttpRequest, asset: str = '') -> FileResponse:
    root = Path(settings.FRONTEND_DIST)
    requested = (root / asset).resolve() if asset else root / 'index.html'
    if not str(requested).startswith(str(root.resolve())) or not requested.exists() or requested.is_dir():
        requested = root / 'index.html'
    content_type = mimetypes.guess_type(str(requested))[0] or 'text/html'
    return FileResponse(requested.open('rb'), content_type=content_type)
