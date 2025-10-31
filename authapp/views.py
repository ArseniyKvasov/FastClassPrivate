import hashlib
import json

import requests
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, get_user_model

from fastlesson import settings

User = get_user_model()



def login_view(request):
    return render(request, 'authapp/login.html')

@login_required
def profile(request):
    return render(request, 'authapp/profile.html', {
        'user': request.user
    })


def vk_callback(request):
    code = request.GET.get('code')
    if not code:
        return render(request, "error.html", {"message": "Нет кода авторизации"})

    token_url = "https://id.vk.com/oauth2/token"
    data = {
        "grant_type": "authorization_code",
        "client_id": settings.VK_ID_CLIENT,
        "client_secret": settings.VK_ID_SECRET,
        "redirect_uri": settings.VK_ID_REDIRECT_URI,
        "code": code,
    }

    response = requests.post(token_url, data=data)
    token_data = response.json()

    access_token = token_data.get("access_token")
    user_id = token_data.get("user_id")
    email = token_data.get("email")

    # Тут логика входа/регистрации пользователя
    return redirect("/")