import json

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST

from rest_framework.exceptions import ValidationError

from courses.models import Section, Task
from classroom.models import Classroom
from classroom.services import check_user_access

from classroom.registry import get_answer_model_by_task_type, get_all_answer_models

User = get_user_model()


def get_task_answer(request):
    """
    Возвращает ответ конкретного пользователя на конкретное задание в классе.

    GET-параметры:
        task_id
        classroom_id
        user_id (target user)
    """
    task_id = request.GET.get("task_id")
    classroom_id = request.GET.get("classroom_id")
    target_user_id = request.GET.get("user_id")

    if not all([task_id, classroom_id, target_user_id]):
        return JsonResponse({"error": "Переданы не все параметры"}, status=400)

    task = get_object_or_404(Task, id=task_id)
    classroom = get_object_or_404(Classroom, id=classroom_id)
    target_user = get_object_or_404(User, id=target_user_id)

    if not check_user_access(request.user, classroom, target_user):
        return JsonResponse({"error": "Access denied"}, status=403)

    answer_model = get_answer_model_by_task_type(task.task_type)
    if not answer_model:
        return JsonResponse({"error": "Unsupported task type"}, status=400)

    answer = answer_model.objects.filter(
        task=task,
        classroom=classroom,
        user=target_user,
    ).first()

    return JsonResponse({
        "task_id": str(task.id),
        "task_type": task.task_type,
        "answer": answer.get_answer_data() if answer else None,
    })


def get_section_answers(request):
    """
    Возвращает ответы пользователя на все задания раздела в рамках класса.

    GET-параметры:
        section_id
        classroom_id
        user_id (target user)
    """
    section_id = request.GET.get("section_id")
    classroom_id = request.GET.get("classroom_id")
    target_user_id = request.GET.get("user_id")

    if not all([section_id, classroom_id, target_user_id]):
        return JsonResponse({"error": "Missing required parameters"}, status=400)

    section = get_object_or_404(Section, id=section_id)
    classroom = get_object_or_404(Classroom, id=classroom_id)
    target_user = get_object_or_404(User, id=target_user_id)

    if not check_user_access(request.user, classroom, target_user):
        return JsonResponse({"error": "Access denied"}, status=403)

    tasks = Task.objects.filter(section=section)
    answers = []

    for task in tasks:
        answer_model = get_answer_model_by_task_type(task.task_type)
        if not answer_model:
            continue

        answer = answer_model.objects.filter(
            task=task,
            classroom=classroom,
            user=target_user,
        ).first()

        answers.append({
            "task_id": str(task.id),
            "task_type": task.task_type,
            "answer": answer.get_answer_data() if answer else None,
        })

    return JsonResponse({
        "section_id": str(section.id),
        "section_title": section.title,
        "answers": answers,
    })


@require_POST
@login_required
def save_answer(request, classroom_id):
    """
    Сохраняет или обновляет ответ пользователя на задание.

    JSON body:
        {
            "task_id": "...",
            "user_id": "...",   # target user
            "data": {...}
        }
    """
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"success": False, "errors": "Invalid JSON"}, status=400)

    task_id = payload.get("task_id")
    target_user_id = payload.get("user_id")
    data = payload.get("data", {})

    if not all([task_id, target_user_id]):
        return JsonResponse({"success": False, "errors": "task_id and user_id required"}, status=400)

    task = get_object_or_404(Task, id=task_id)
    classroom = get_object_or_404(Classroom, id=classroom_id)
    target_user = get_object_or_404(User, id=target_user_id)

    if not check_user_access(request.user, classroom, target_user):
        return JsonResponse({"error": "Access denied"}, status=403)

    answer_model = get_answer_model_by_task_type(task.task_type)
    if not answer_model:
        return JsonResponse({"success": False, "errors": "Unsupported task type"}, status=400)

    try:
        answer, created = answer_model.objects.get_or_create(
            task=task,
            classroom=classroom,
            user=target_user,
        )

        answer.save_answer_data(data)
        answer.refresh_from_db()
        print(answer.get_answer_data())

        return JsonResponse({
            "success": True,
            "created": created,
            "answer": answer.get_answer_data(),
        })

    except ValidationError as exc:
        return JsonResponse({"success": False, "errors": str(exc)}, status=400)
    except Exception as e:
        print(e)
        return JsonResponse({"success": False, "errors": "Internal server error"}, status=500)


@require_POST
@login_required
def mark_answer_as_checked(request, classroom_id):
    """
    Помечает ответ пользователя как проверенный.
    Используется учителем.
    """
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"success": False, "errors": "Invalid JSON"}, status=400)

    task_id = payload.get("task_id")
    target_user_id = payload.get("user_id")

    if not all([task_id, target_user_id]):
        return JsonResponse({"success": False, "errors": "task_id and user_id required"}, status=400)

    task = get_object_or_404(Task, id=task_id)
    classroom = get_object_or_404(Classroom, id=classroom_id)
    target_user = get_object_or_404(User, id=target_user_id)

    if not check_user_access(request.user, classroom, target_user):
        return JsonResponse({"error": "Access denied"}, status=403)

    answer_model = get_answer_model_by_task_type(task.task_type)
    if not answer_model or not hasattr(answer_model, "mark_as_checked"):
        return JsonResponse(
            {"success": False, "errors": "Task type does not support checking"},
            status=400,
        )

    answer = get_object_or_404(
        answer_model,
        task=task,
        classroom=classroom,
        user=target_user,
    )

    try:
        answer.mark_as_checked()
        return JsonResponse({
            "success": True,
            "answer": answer.get_answer_data(),
        })
    except Exception:
        return JsonResponse({"success": False, "errors": "Internal server error"}, status=500)
