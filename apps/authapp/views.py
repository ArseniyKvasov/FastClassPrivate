import hashlib

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, get_user_model

User = get_user_model()



def login_view(request):
    return render(request, 'authapp/login.html')

@login_required
def profile(request):
    return render(request, 'authapp/profile.html', {
        'user': request.user
    })


def vk_custom_login(request):
    code = request.GET.get('code')
    device_id = request.GET.get('device_id')
    vk_id = request.GET.get('ext_id')

    if not code or not device_id or not vk_id:
        return JsonResponse({'error': 'missing parameters'}, status=400)

    # Получаем или создаём пользователя
    user, created = User.objects.get_or_create(
        vk_id=vk_id,
        defaults={
            'username': f'vk_{hashlib.sha1(vk_id.encode("utf-8")).hexdigest()[:10]}',
            'email': None
        }
    )

    # Если создан — ставим unusable password
    if created:
        user.set_unusable_password()
        user.save()

    # Логиним пользователя
    user.backend = "apps.authapp.backends.SocialIDBackend"
    login(request, user)

    return redirect('profile')
