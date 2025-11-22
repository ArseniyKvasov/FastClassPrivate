# pages/views.py
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login
from django.contrib.auth import get_user_model

User = get_user_model()


def login_view(request):
    if request.method == "POST":
        email = request.POST.get("email")
        password = request.POST.get("password")

        user = authenticate(request, username=email, password=password)
        if user:
            login(request, user)
            return redirect("home")

        return render(request, "pages/login.html", {"error": "Неверные данные"})

    return render(request, "authapp/login.html")


def register_view(request):
    if request.method == "POST":
        email = request.POST.get("email")
        password = request.POST.get("password")
        password2 = request.POST.get("password2")

        if password != password2:
            return render(request, "authapp/register.html", {"error": "Пароли не совпадают"})

        if User.objects.filter(username=email).exists():
            return render(request, "authapp/register.html", {"error": "Пользователь уже существует"})

        user = User.objects.create_user(username=email, email=email, password=password)

        user.backend = "django.contrib.auth.backends.ModelBackend"

        login(request, user)
        return redirect("home")

    return render(request, "authapp/register.html")





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