from django.urls import path
from django.contrib.admin.views.decorators import staff_member_required
from . import views

app_name = 'admin_panel'

urlpatterns = [
    path('', views.dashboard_view, name='dashboard'),
    path('logs/', views.logs_view, name='logs'),
    path('users/', views.users_view, name='users'),
    path('courses/clone/', views.clone_course_view, name='clone_course'),
]