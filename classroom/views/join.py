"""
Join classroom flow (student / limited access user)

Flow:

1. Пользователь открывает страницу входа в класс по ссылке (возможно с параметром ?pw=).

2. Проверка авторизации:
   - Если пользователь уже авторизован и является учителем или учеником этого класса:
     - выполняется редирект сразу в класс
   - Иначе продолжаем flow

3. Проверка существующей верификации из сессии:
   - Если в сессии есть флаг verified для этого класса:
     - проверяется TTL (5 минут)
     - проверяется соответствие сохраненного в сессии пароля текущему паролю класса
     - если TTL истек или пароль не совпадает - сессия очищается
   - Результат: password_verified (true/false)

4. Проверка пароля из ссылки:
   - Если в URL есть параметр pw:
     - пароль проверяется на сервере
     - если пароль правильный:
       - в сессии сохраняется: флаг verified, timestamp и сам пароль
       - initial_password сохраняется для отображения в поле ввода
       - password_verified = true
     - если пароль неправильный:
       - сессия очищается (предыдущая верификация удаляется)
       - initial_password не передается
       - password_verified = false

5. Отображение модалки выбора роли:
   - По умолчанию выбрана роль "Ученик"
   - При выборе "Учитель" - редирект на страницу входа с next=текущий URL

6. После выбора роли "Ученик":
   - Если password_verified = true:
     - сразу открывается модалка ввода имени/фамилии
   - Если password_verified = false:
     - открывается модалка ввода пароля

7. В модалке пароля:
   - Если есть initial_password (из правильной ссылки):
     - поле автоматически заполняется
     - кнопка "Продолжить" активна
   - При вводе пароля и нажатии "Продолжить":
     - пароль проверяется на сервере
     - при успехе:
       - в сессии сохраняется пароль, timestamp и флаг verified
       - открывается модалка имени
     - при неуспехе:
       - показывается ошибка
       - сессия очищается

8. В модалке имени/фамилии:
   - Вводятся имя и фамилия (валидация: буквы, дефис, слеш, 1-18 символов)
   - При нажатии "Войти" (или Enter на фамилии):
     - данные отправляются на сервер для финализации

9. На этапе финализации:
   - Если у класса есть пароль:
     - из сессии извлекается сохраненный пароль
     - проверяется его соответствие текущему паролю класса
     - если пароль не совпадает или отсутствует - возвращается ошибка
   - Имя и фамилия приводятся к lower-case для поиска
   - Среди учеников класса ищется пользователь:
       - has_full_access = False
       - совпадение first_name и last_name (case-insensitive)

10. Если пользователь найден:
    - выполняется login под существующим аккаунтом
    - сессия verified очищается

11. Если пользователь не найден:
    - создаётся новый пользователь с ограниченным доступом
    - имя и фамилия сохраняются в формате Capitalized
    - пользователь добавляется в класс
    - выполняется login
    - сессия verified очищается

12. После успешного входа:
    - выполняется редирект на страницу класса

13. Навигация:
    - Из модалки имени можно вернуться к паролю (кнопка "назад")
    - Из модалки пароля можно вернуться к выбору роли (кнопка "назад")
    - При возврате к паролю, если есть initial_password, поле снова заполняется

14. Безопасность:
    - Сессия verified имеет TTL 1 минуту
    - В сессии хранится не только флаг, но и сам пароль (для проверки актуальности)
    - При каждой проверке пароля (успешной или неуспешной) сессия обновляется/очищается
    - При изменении пароля учителем все существующие сессии verified становятся недействительными
    - Нельзя перейти к вводу имени без подтвержденного и актуального пароля
    - Нельзя финализировать вход с просроченной, отсутствующей или неактуальной верификацией
"""

import json
from django.shortcuts import get_object_or_404, redirect, render
from django.contrib.auth import login, get_user_model
from django.views.decorators.http import require_POST
from django.http import JsonResponse
from django.urls import reverse
from django.views.decorators.csrf import ensure_csrf_cookie
from classroom.models import Classroom
from classroom.services import validate_name_parts, verify_classroom_password
from .sessions import is_session_verified, set_verified_in_session, clear_verified_in_session, \
    get_verified_password_hash

User = get_user_model()


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

    password_verified = False
    if has_password:
        verified_password_hash = get_verified_password_hash(request, classroom)
        if verified_password_hash and verify_classroom_password(classroom, verified_password_hash):
            password_verified = True
        else:
            clear_verified_in_session(request, classroom)
    else:
        password_verified = True

    initial_password = request.GET.get("pw", "")
    password_valid = False

    if initial_password:
        if verify_classroom_password(classroom, initial_password):
            password_valid = True
            if request.user.is_authenticated:
                if not classroom.students.filter(id=request.user.id).exists():
                    classroom.join(request.user, classroom.join_password or "")
                clear_verified_in_session(request, classroom)
                return redirect("classroom_view", classroom_id=classroom.id)

            set_verified_in_session(request, classroom, initial_password)
            password_verified = True
        else:
            clear_verified_in_session(request, classroom)
            password_verified = False

    return render(
        request,
        "classroom/join.html",
        {
            "classroom": classroom,
            "password_verified": password_verified,
            "has_password": has_password,
            "initial_password": initial_password if password_valid else "",
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

        set_verified_in_session(request, classroom, "")
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

        set_verified_in_session(request, classroom, password)
    else:
        clear_verified_in_session(request, classroom)

    return JsonResponse({"ok": ok})


@require_POST
def join_classroom_finalize_view(request, classroom_id):
    classroom = get_object_or_404(Classroom, pk=classroom_id)

    if classroom.join_password:
        verified_password_hash = get_verified_password_hash(request, classroom)
        if not verified_password_hash or not verify_classroom_password(classroom, verified_password_hash):
            return JsonResponse(
                {"ok": False, "error": "Пароль класса устарел или неверен. Вернитесь назад."},
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