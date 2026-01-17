from django.urls import path
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("course/<str:course_id>/", views.course_detail, name="course_detail"),
    path('api/users/<int:user_id>/get-username-by-id/', views.get_username_by_id, name='get_username_by_id'),
]
