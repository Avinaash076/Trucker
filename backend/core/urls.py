from django.urls import path
from .views import analyze, health

urlpatterns = [
    path('health', health),
    path('analyze', analyze),
]
