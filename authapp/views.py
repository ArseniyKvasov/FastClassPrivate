import hashlib
import hmac
import json
import time

from django.conf import settings
from django.contrib.auth import authenticate, login, get_user_model
from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.views.decorators.http import require_POST

User = get_user_model()

def login_view(request):
    if request.method == "POST":
        email = request.POST.get("email")
        password = request.POST.get("password")
        next_url = request.POST.get("next") or request.GET.get("next") or "home"

        user = authenticate(request, username=email, password=password)
        if user:
            login(request, user)
            return redirect(next_url)

        return render(request, "authapp/login.html", {
            "error": "Неверные данные",
            "next": next_url
        })

    next_url = request.GET.get("next", "home")
    return render(request, "authapp/login.html", {"next": next_url})

def register_view(request):
    if request.method == "POST":
        email = request.POST.get("email")
        password = request.POST.get("password")
        password2 = request.POST.get("password2")
        next_url = request.POST.get("next") or request.GET.get("next") or "home"

        if password != password2:
            return render(request, "authapp/register.html", {
                "error": "Пароли не совпадают",
                "next": next_url
            })

        if User.objects.filter(username=email).exists():
            return render(request, "authapp/register.html", {
                "error": "Пользователь уже существует",
                "next": next_url
            })

        user = User.objects.create_user(username=email, email=email, password=password)
        user.backend = "django.contrib.auth.backends.ModelBackend"

        login(request, user)
        return redirect(next_url)

    next_url = request.GET.get("next", "home")
    return render(request, "authapp/register.html", {"next": next_url})


@require_POST
def telegram_widget_login(request):
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Неверный формат данных"}, status=400)

    bot_token = settings.TELEGRAM_BOT_TOKEN
    if not bot_token:
        return JsonResponse({"error": "Telegram авторизация не настроена"}, status=500)

    required_fields = {"id", "auth_date", "hash", "first_name"}
    if not required_fields.issubset(payload):
        return JsonResponse({"error": "Недостаточно данных авторизации"}, status=400)

    telegram_hash = payload.get("hash", "")
    check_data = {
        key: value for key, value in payload.items()
        if key != "hash" and value is not None
    }

    data_check_string = "\n".join(
        f"{key}={check_data[key]}"
        for key in sorted(check_data.keys())
    )

    secret_key = hashlib.sha256(bot_token.encode("utf-8")).digest()
    calculated_hash = hmac.new(
        secret_key,
        data_check_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(calculated_hash, telegram_hash):
        return JsonResponse({"error": "Неверная подпись Telegram"}, status=403)

    try:
        auth_timestamp = int(payload["auth_date"])
    except (TypeError, ValueError):
        return JsonResponse({"error": "Неверная дата авторизации"}, status=400)

    if time.time() - auth_timestamp > 86400:
        return JsonResponse({"error": "Данные авторизации устарели"}, status=403)

    telegram_id = str(payload.get("id"))
    telegram_username = payload.get("username")
    first_name = payload.get("first_name") or ""
    last_name = payload.get("last_name") or ""

    user, created = User.objects.get_or_create(
        telegram_id=telegram_id,
        defaults={
            "username": User._generate_username(),
            "telegram_username": telegram_username,
            "first_name": first_name,
            "last_name": last_name,
            "has_full_access": True,
        },
    )

    if not created:
        updated_fields = []
        if telegram_username and user.telegram_username != telegram_username:
            user.telegram_username = telegram_username
            updated_fields.append("telegram_username")
        if first_name and user.first_name != first_name:
            user.first_name = first_name
            updated_fields.append("first_name")
        if last_name and user.last_name != last_name:
            user.last_name = last_name
            updated_fields.append("last_name")
        if not user.has_full_access:
            user.has_full_access = True
            updated_fields.append("has_full_access")
        if updated_fields:
            user.save(update_fields=updated_fields)

    login(request, user, backend="django.contrib.auth.backends.ModelBackend")

    next_url = payload.get("next") or "/"
    return JsonResponse({"ok": True, "next": next_url})




"""
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

"""
