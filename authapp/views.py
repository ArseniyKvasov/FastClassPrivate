import hmac
import hashlib
import json
from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.views.decorators.clickjacking import xframe_options_exempt
from .models import User


def set_coop_header(view_func):
    def _wrapped_view(request, *args, **kwargs):
        response = view_func(request, *args, **kwargs)
        response["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
        return response

    return _wrapped_view


def check_auth(request):
    """
    Проверяет, авторизован ли пользователь
    """
    return JsonResponse({
        'authenticated': request.user.is_authenticated
    })


@set_coop_header
@xframe_options_exempt
def login_page(request):
    context = {
        'TELEGRAM_BOT_NAME': settings.TELEGRAM_BOT_NAME
    }
    return render(request, 'auth/login.html', context)


def telegram_callback(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            bot_token = settings.TELEGRAM_BOT_TOKEN
            received_hash = data.pop('hash')

            data_check_list = []
            for key, value in sorted(data.items()):
                if value:
                    data_check_list.append(f"{key}={value}")
            data_check_string = "\n".join(data_check_list)

            secret_key = hashlib.sha256(bot_token.encode()).digest()
            hmac_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

            if hmac_hash != received_hash:
                return JsonResponse({'error': 'Invalid hash'}, status=400)

            tg_id = str(data.get('id'))
            user = User.objects.filter(telegram_id=tg_id).first()

            if not user:
                user = User.create_full_user_with_telegram(
                    telegram_id=tg_id,
                    telegram_username=data.get('username'),
                    first_name=data.get('first_name'),
                    last_name=data.get('last_name')
                )

            login(request, user)
            return JsonResponse({'status': 'ok'})

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': 'Method not allowed'}, status=405)