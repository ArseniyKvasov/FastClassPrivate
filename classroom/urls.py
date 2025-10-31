from django.urls import path
from . import views

urlpatterns = [
    path("", views.classroom_view, name="classroom_view"),
]