from django.shortcuts import render, get_object_or_404, redirect
from django.urls import reverse
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponseForbidden
import json
from django.views.decorators.http import require_POST

from core.services import get_display_name_from_username
from classroom.models import Classroom
from classroom.services import (
    get_current_lesson,
    set_copying,
)
from .session_utils import clear_verified_in_session


def classroom_view(request, classroom_id):
    """
    Основная страница комнаты — только для авторизованных пользователей.
    """
    if not request.user.is_authenticated:
        return redirect("join_classroom_view", classroom_id=classroom_id)

    classroom = get_object_or_404(Classroom, pk=classroom_id)
    lesson = get_current_lesson(classroom_id)

    students_qs = classroom.students.all().values("id", "username")
    is_teacher = request.user == classroom.teacher

    if request.user not in classroom.students.all() and not is_teacher:
        return redirect("join_classroom_view", classroom_id=classroom_id)

    students_list = []
    if is_teacher:
        students_list = [
            {"id": s["id"], "name": get_display_name_from_username(s["username"])}
            for s in students_qs
        ]
        if not students_list:
            students_list = [{"id": request.user.id, "name": request.user.username}]
        viewed_user_id = students_list[0]["id"]
    else:
        viewed_user_id = request.user.id

    return render(
        request,
        "classroom/classroom_page.html",
        context={
            "classroom": classroom,
            "classroom_id": classroom.id,
            "lesson_id": lesson.id if lesson else None,
            "is_teacher": is_teacher,
            "viewed_user_id": viewed_user_id,
            "students_list": students_list,
            "current_user_id": request.user.id,
            "copying_enabled": getattr(classroom, "copying_enabled", True),
        },
    )


@login_required
def get_current_lesson_id(request, classroom_id):
    classroom = get_object_or_404(Classroom, pk=classroom_id)
    lesson = getattr(classroom, "lesson", None)
    return JsonResponse({"lesson_id": lesson.id if lesson else None})


@login_required
@require_POST
def change_classroom_password(request, classroom_id):
    """
    Смена пароля комнаты — доступна только учителю.
    Ограничения: только цифры, до 12 символов.
    """
    classroom = get_object_or_404(Classroom, pk=classroom_id)

    if request.user != classroom.teacher:
        return JsonResponse({"ok": False, "error": "Нет прав для изменения пароля."}, status=403)

    try:
        data = json.loads(request.body)
    except Exception:
        return JsonResponse({"ok": False, "error": "Некорректный формат данных."}, status=400)

    new_password = data.get("password", "").strip()

    if not new_password:
        return JsonResponse({"ok": False, "error": "Пароль не может быть пустым."}, status=400)

    if len(new_password) > 12:
        return JsonResponse({"ok": False, "error": "Пароль не должен превышать 12 символов."}, status=400)

    if not new_password.isdigit():
        return JsonResponse({"ok": False, "error": "Пароль должен состоять только из цифр."}, status=400)

    classroom.join_password = new_password
    classroom.save(update_fields=["join_password"])

    clear_verified_in_session(request, classroom)

    return JsonResponse({"ok": True, "password": new_password})


@login_required
@require_POST
def set_copying_enabled(request, classroom_id):
    """
    Переключает разрешение копирования в комнате; проверяет права через set_copying.
    """
    classroom = get_object_or_404(Classroom, pk=classroom_id)
    try:
        data = json.loads(request.body)
        enabled = bool(data.get("enabled"))
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Некорректные данные"}, status=400)

    ok, result = set_copying(classroom, request.user, enabled)
    if not ok:
        return HttpResponseForbidden(result)

    return JsonResponse({"copying_enabled": result})
