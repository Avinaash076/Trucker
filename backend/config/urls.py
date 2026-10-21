from django.urls import include, path, re_path
from core.views import frontend

urlpatterns = [
    path('api/', include('core.urls')),
    re_path(r'^(?P<asset>.*)$', frontend),
]
