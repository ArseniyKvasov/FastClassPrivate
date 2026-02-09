import json
from django.shortcuts import get_object_or_404, redirect, render
from django.contrib.auth import login, get_user_model
from django.views.decorators.http import require_POST
from django.http import JsonResponse
from django.urls import reverse
from django.views.decorators.csrf import ensure_csrf_cookie
from classroom.models import Classroom
from classroom.services import validate_name_parts, verify_classroom_password
from .sessions import is_session_verified, set_verified_in_session, clear_verified_in_session

User = get_user_model()

"""
Join classroom flow (student / limited access user)

Flow:

1. Пользователь открывает страницу входа в класс.
2. Если у класса есть пароль:
   - пользователь вводит пароль
   - пароль проверяется сервером
   - результат сохраняется в session с TTL

3. После успешной проверки пароля пользователь вводит имя и фамилию.

4. На этапе финализации:
   - имя и фамилия приводятся к lower-case
   - среди учеников класса ищется пользователь:
       - has_full_access = False
       - совпадение first_name и last_name (case-insensitive)

5. Если пользователь найден:
   - выполняется login под существующим аккаунтом

6. Если пользователь не найден:
   - создаётся новый пользователь с ограниченным доступом
   - имя и фамилия сохраняются в формате Capitalized
   - пользователь добавляется в класс
   - выполняется login

7. Telegram не требуется.
   Аккаунты с полным доступом не могут быть авторизованы через classroom join.
"""

@ensure_csrf_cookie
def join_classroom_view(request, classroom_id):
    classroom = get_object_or_404(Classroom, pk=classroom_id)

    if request.user.is_authenticated:
        if (
            request.user == classroom.teacher
            or classroom.students.filter(id=request.user.id).exists()
        ):
            return redirect("classroom_view", classroom_id=classroom.id)

    has_password = bool(classroom.join_password)
    password_verified = is_session_verified(request, classroom)

    if not has_password:
        password_verified = True

    pw = request.GET.get("pw")
    if pw and verify_classroom_password(classroom, pw):
        if request.user.is_authenticated:
            if not classroom.students.filter(id=request.user.id).exists():
                classroom.join(request.user, classroom.join_password or "")
            clear_verified_in_session(request, classroom)
            return redirect("classroom_view", classroom_id=classroom.id)

        set_verified_in_session(request, classroom)
        password_verified = True

    return render(
        request,
        "classroom/join.html",
        {
            "classroom": classroom,
            "password_verified": password_verified,
            "has_password": has_password,
        },
    )

@require_POST
def verify_classroom_password_view(request, classroom_id):
    classroom = get_object_or_404(Classroom, pk=classroom_id)

    try:
        data = json.loads(request.body)
        password = (data.get("password") or "").strip()
    except json.JSONDecodeError:
        return JsonResponse({"ok": False, "error": "Некорректный JSON"}, status=400)

    if not classroom.join_password:
        if request.user.is_authenticated:
            if not classroom.students.filter(id=request.user.id).exists():
                classroom.join(request.user, "")
            clear_verified_in_session(request, classroom)
            return JsonResponse(
                {"ok": True, "redirect": reverse("classroom_view", args=[classroom.id])}
            )

        set_verified_in_session(request, classroom)
        return JsonResponse({"ok": True})

    if not password:
        return JsonResponse({"ok": False, "error": "Пароль обязателен"}, status=400)

    ok = verify_classroom_password(classroom, password)

    if ok:
        if request.user.is_authenticated:
            if not classroom.students.filter(id=request.user.id).exists():
                classroom.join(request.user, classroom.join_password or "")
            clear_verified_in_session(request, classroom)
            return JsonResponse(
                {"ok": True, "redirect": reverse("classroom_view", args=[classroom.id])}
            )

        set_verified_in_session(request, classroom)

    return JsonResponse({"ok": ok})

@require_POST
def join_classroom_finalize_view(request, classroom_id):
    classroom = get_object_or_404(Classroom, pk=classroom_id)

    if classroom.join_password and not is_session_verified(request, classroom):
        return JsonResponse(
            {"ok": False, "error": "Пароль класса устарел или неверен."},
            status=403,
        )

    if request.user.is_authenticated:
        if not classroom.students.filter(id=request.user.id).exists():
            classroom.join(request.user, classroom.join_password or "")
        clear_verified_in_session(request, classroom)
        return JsonResponse(
            {"ok": True, "redirect": reverse("classroom_view", args=[classroom.id])}
        )

    try:
        data = json.loads(request.body)
        first_name = (data.get("first_name") or "").strip()
        last_name = (data.get("last_name") or "").strip()
    except json.JSONDecodeError:
        return JsonResponse(
            {"ok": False, "error": "Некорректный JSON."},
            status=400,
        )

    try:
        validate_name_parts(first_name, last_name)
    except Exception as e:
        return JsonResponse(
            {"ok": False, "error": str(e)},
            status=400,
        )

    normalized_first = first_name.lower()
    normalized_last = last_name.lower()

    user = classroom.students.filter(
        has_full_access=False,
        first_name__iexact=normalized_first,
        last_name__iexact=normalized_last,
    ).first()

    if not user:
        user = User.create_limited_user(
            first_name=normalized_first.capitalize(),
            last_name=normalized_last.capitalize(),
        )
        classroom.join(user, classroom.join_password or "")

    login(request, user)
    clear_verified_in_session(request, classroom)

    return JsonResponse(
        {"ok": True, "redirect": reverse("classroom_view", args=[classroom.id])}
    )
