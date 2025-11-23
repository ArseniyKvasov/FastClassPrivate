from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, get_user_model
from django.contrib.auth.models import User

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