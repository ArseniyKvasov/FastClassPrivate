from django.urls import path
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("course/<str:course_id>/>", views.course_detail, name="course_detail"),
]
