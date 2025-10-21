from django.urls import path

from . import views

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('vk/custom-login/', views.vk_custom_login),
    path('profile/', views.profile, name='profile'),
]
