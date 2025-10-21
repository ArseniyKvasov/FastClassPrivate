from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("", include("apps.pages.urls")),
    path("auth/", include("apps.authapp.urls")),
]