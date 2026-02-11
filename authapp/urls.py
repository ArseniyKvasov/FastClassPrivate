from django.urls import path

from . import views


urlpatterns = [
    path("login/", views.login_view, name="login"),
    path("register/", views.register_view, name="register"),
    path("telegram/widget-login/", views.telegram_widget_login, name="telegram_widget_login"),
]


"""
urlpatterns = [
    path("login/", views.login_view, name="login"),
    path("vk/custom-login/", views.vk_callback, name="vk_custom_login"),  # GET и POST
    path('profile/', views.profile, name='profile'),
]
"""
