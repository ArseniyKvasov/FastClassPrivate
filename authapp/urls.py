from django.urls import path
from . import views


urlpatterns = [
    path('api/check/', views.check_auth, name='check_auth'),
    path('login/', views.login_page, name='login'),
    path('callback/', views.telegram_callback, name='telegram_callback'),
]