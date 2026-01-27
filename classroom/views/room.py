from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponseForbidden, Http404
from django.views.decorators.http import require_POST
from django.db import transaction
import json
from django.urls import reverse

from django.contrib.auth import get_user_model

from core.services import get_display_name_from_username
from courses.models import Lesson
from courses.services import CourseNeedsUpdate, CourseUnavailableError
from classroom.models import Classroom
from classroom.services import set_copying, attach_lesson_to_classroom
from .session_utils import clear_verified_in_session

User = get_user_model()


@login_required
@require_POST
@transaction.atomic
def create_classroom_view(request):
    """
    Создаёт новый класс и при необходимости прикрепляет урок.
    Если у пользователя нет курса с нужным уроком — копирует курс.
    Возвращает JSON с redirect_url или error.
    """
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse(
            {"error": "Некорректный формат данных"},
            status=400
        )

    title = (payload.get("title") or "").strip()
    lesson_id = payload.get("lesson_id")

    if not title:
        return JsonResponse(
            {"error": "Введите название класса"},
            status=400
        )

    if len(title) > 30:
        return JsonResponse(
            {"error": "Название класса не должно превышать 30 символов"},
            status=400
        )

    classroom = Classroom.objects.create(
        title=title,
        teacher=request.user
    )

    if lesson_id:
        lesson = get_object_or_404(Lesson, pk=lesson_id)
        attach_lesson_to_classroom(classroom, lesson, request.user)

    return JsonResponse({
        "redirect_url": reverse("classroom_view", args=[classroom.id])
    })


@login_required
@require_POST
def delete_classroom_view(request, classroom_id):
    """
    Удаляет класс. Доступ разрешён только учителю (создателю класса).
    Возвращает JSON с результатом.
    """
    try:
        classroom = Classroom.objects.get(id=classroom_id)
    except Classroom.DoesNotExist:
        raise Http404("Класс не найден")

    if classroom.teacher != request.user:
        return JsonResponse({"error": "Недостаточно прав"}, status=403)

    classroom.delete()
    return JsonResponse({"success": True})


@login_required
@require_POST
def classroom_edit_title_view(request, classroom_id):
    """
    Обновляет название класса.

    Доступ разрешён только пользователю с ролью teacher в данном классе.
    Ожидает POST-параметр `title`.
    Возвращает JSON с новым названием или ошибкой.
    """
    try:
        classroom = Classroom.objects.get(id=classroom_id)
    except Classroom.DoesNotExist:
        raise Http404("Класс не найден")

    if classroom.teacher != request.user:
        return JsonResponse(
            {"error": "Недостаточно прав"},
            status=403
        )

    title = request.POST.get("title", "").strip()
    if not title:
        return JsonResponse(
            {"error": "Название не может быть пустым"},
            status=400
        )

    classroom.title = title
    classroom.save(update_fields=["title"])

    return JsonResponse({
        "success": True,
        "updated": {
            "title": classroom.title
        }
    })


def classroom_view(request, classroom_id):
    if not request.user.is_authenticated:
        return redirect("join_classroom_view", classroom_id=classroom_id)

    classroom = get_object_or_404(Classroom, pk=classroom_id)

    is_teacher = request.user == classroom.teacher

    if request.user not in classroom.students.all() and not is_teacher:
        return redirect("join_classroom_view", classroom_id=classroom_id)

    students_qs = classroom.students.all().values("id", "username")

    if is_teacher:
        students_list = [
            {"id": s["id"], "name": get_display_name_from_username(s["username"])}
            for s in students_qs
        ]
        if not students_list:
            students_list = [{"id": request.user.id, "name": get_display_name_from_username(request.user.username)}]
        viewed_user_id = students_list[0]["id"]
    else:
        students_list = []
        viewed_user_id = request.user.id

    lesson_id = classroom.lesson.id if classroom.lesson else None

    return render(
        request,
        "classroom/classroom_page.html",
        context={
            "classroom": classroom,
            "classroom_id": classroom.id,
            "lesson_id": lesson_id,
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

    if request.user != classroom.teacher and request.user not in classroom.students.all():
        return JsonResponse({"error": "Доступ запрещен."}, status=403)

    return JsonResponse({
        "lesson_id": classroom.lesson.id,
    })


@login_required
@require_POST
def change_classroom_password(request, classroom_id):
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


@require_POST
@login_required
def delete_student(request, classroom_id):
    try:
        data = json.loads(request.body)
        student_id = data['student_id']

        classroom = Classroom.objects.get(id=classroom_id)
        if classroom.teacher != request.user:
            return JsonResponse({'error': 'Только учитель может удалить ученика'}, status=403)

        student = get_object_or_404(User, id=student_id)
        result = classroom.remove_student(student)

        if not result['success']:
            return JsonResponse({'error': result.get('error', 'Неизвестная ошибка')}, status=400)

        return JsonResponse({
            'success': True,
            'removed': result['removed'],
            'student_id': student_id,
            'remaining_students': result.get('remaining_students', classroom.students.count())
        })

    except KeyError:
        return JsonResponse({'error': 'Не указан ID ученика'}, status=400)
    except Classroom.DoesNotExist:
        return JsonResponse({'error': 'Класс не найден'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Некорректный JSON в теле запроса'}, status=400)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@login_required
@require_POST
def attach_lesson_view(request, classroom_id, lesson_id):
    """
    Прикрепляет урок к классу.

    Возможные ответы:
    - status=ok
    - status=update_required
    - 400 — логическая ошибка
    """
    classroom = get_object_or_404(
        Classroom,
        pk=classroom_id,
        teacher=request.user
    )
    lesson = get_object_or_404(Lesson, pk=lesson_id)

    try:
        attach_lesson_to_classroom(
            classroom,
            lesson,
            request.user
        )
    except CourseNeedsUpdate as e:
        return JsonResponse({
            "status": "update_required",
            "course_id": e.user_course_id,
        })
    except (CourseUnavailableError, ValueError) as e:
        return JsonResponse(
            {"status": "error", "detail": str(e)},
            status=400
        )

    return JsonResponse({"status": "ok"})
