from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponseForbidden
from django.views.decorators.http import require_POST
from django.db import transaction
import json
from django.contrib.auth import get_user_model

from core.services import get_display_name_from_username
from courses.models import Lesson
from classroom.models import Classroom
from classroom.services import set_copying
from .session_utils import clear_verified_in_session

User = get_user_model()


def classroom_view(request, classroom_id):
    if not request.user.is_authenticated:
        return redirect("join_classroom_view", classroom_id=classroom_id)

    classroom = get_object_or_404(Classroom, pk=classroom_id)
    lesson_info = classroom.get_attached_lesson()

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
            students_list = [{"id": request.user.id, "name": request.user.username}]
        viewed_user_id = students_list[0]["id"]
    else:
        students_list = []
        viewed_user_id = request.user.id

    lesson_id = lesson_info["id"] if lesson_info else None

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

    lesson_info = classroom.get_attached_lesson()
    return JsonResponse({
        "lesson_id": lesson_info["id"] if lesson_info else None,
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
    classroom = get_object_or_404(Classroom, pk=classroom_id, teacher=request.user)
    lesson = get_object_or_404(Lesson, pk=lesson_id)

    try:
        classroom.attach_lesson(lesson, request.user)
        lesson_info = classroom.get_attached_lesson()
    except (ValueError, TypeError) as e:
        return JsonResponse({"detail": str(e)}, status=400)

    attached = {
        "id": lesson_info["id"] if lesson_info else None,
        "is_copy": lesson_info["is_copy"] if lesson_info else False
    }

    return JsonResponse({
        "status": "ok",
        "attached": attached,
    })


@login_required
@require_POST
@transaction.atomic
def create_classroom_view(request):
    title = request.POST.get("title")
    lesson_id = request.POST.get("lesson_id")

    if not title:
        return JsonResponse({"detail": "Не указано название класса"}, status=400)

    classroom = Classroom.objects.create(
        title=title,
        teacher=request.user
    )

    attached_result = None
    if lesson_id:
        lesson = get_object_or_404(Lesson, pk=lesson_id)
        try:
            classroom.attach_lesson(lesson, request.user)
            lesson_info = classroom.get_attached_lesson()
            attached_result = {
                "id": lesson_info["id"] if lesson_info else None,
                "is_copy": lesson_info["is_copy"] if lesson_info else False
            }
        except (ValueError, TypeError):
            attached_result = None

    return JsonResponse({
        "status": "ok",
        "classroom": {
            "id": classroom.id,
            "title": classroom.title,
        },
        "attached_lesson": attached_result
    })