import json
import re

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.shortcuts import render
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_POST

from .models import Classroom, TestTaskAnswer, TrueFalseTaskAnswer, TextInputTaskAnswer, FillGapsTaskAnswer, \
    MatchCardsTaskAnswer
from courses.models import Task

User = get_user_model()

def classroom_view(request, classroom_id):
    classroom = get_object_or_404(Classroom, pk=classroom_id)
    lesson = classroom.lesson

    sections = lesson.sections.order_by("order") if lesson else []
    first_section = sections.first() if lesson else None
    section_id = first_section.id if first_section else None

    return render(
        request,
        "classroom/classroom.html",
        context={
            "classroom_id": classroom.id,
            "lesson_id": lesson.id if lesson else None,
            "sections": sections,
            "section_id": section_id,
            "is_admin": True,
            "room_type": "Classroom",
            "current_user_id": request.user.id,
        }
    )


answer_models = {
    "test": TestTaskAnswer,
    "true_false": TrueFalseTaskAnswer,
    "fill_gaps": FillGapsTaskAnswer,
    "match_cards": MatchCardsTaskAnswer,
    "text_input": TextInputTaskAnswer,
}


def is_user_in_virtual_class(user, virtual_class_id):
    """Проверяет, находится ли пользователь в виртуальном классе"""
    if user.is_authenticated:
        return True
    return False


@require_POST
@login_required
def save_answer(request, classroom_id):
    """
    Основная точка сохранения ответов.

    Принимает JSON-структуру:
        {
            "task_id": "...",
            "data": {...}
        }
    """
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"success": False, "errors": "Invalid JSON"}, status=400)

    task_id = payload.get("task_id")
    data = payload.get("data", {})

    if not classroom_id:
        return JsonResponse({"success": False, "errors": "virtual_class_id required"}, status=400)
    if not is_user_in_virtual_class(request.user, classroom_id):
        return JsonResponse({"success": False, "errors": "User not in virtual class"}, status=403)
    if not task_id:
        return JsonResponse({"success": False, "errors": "task_id required"}, status=400)

    task = get_object_or_404(Task, pk=task_id)
    task_type = task.task_type

    if task_type not in answer_models:
        return JsonResponse({"success": False, "errors": "Unsupported task type"}, status=400)

    answer_model = answer_models[task_type]

    try:
        answer, created = answer_model.objects.get_or_create(
            task=task,
            user=request.user
        )

        answer.save_answer_data(data)

        return JsonResponse({
            "success": True,
            "answer": answer.get_answer_data(),
            "created": created
        })

    except ValidationError as e:
        return JsonResponse({"success": False, "errors": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"success": False, "errors": "Internal server error"}, status=500)


def get_task_answer(request):
    """
    Универсальный endpoint для получения ответа на задание

    Принимает параметры: task_id, classroom_id, user_id
    """
    task_id = request.GET.get("task_id")
    classroom_id = request.GET.get("classroom_id")
    user_id = request.GET.get("user_id")

    if not task_id or not classroom_id or not user_id:
        return JsonResponse({"error": "Missing required parameters"}, status=400)

    task = get_object_or_404(Task, id=task_id)
    user = get_object_or_404(User, id=user_id)

    if not is_user_in_virtual_class(user, classroom_id):
        return JsonResponse({"error": "User not in virtual class"}, status=403)

    task_type = task.task_type

    if task_type not in answer_models:
        return JsonResponse({"error": "Unknown task type"}, status=400)

    answer_model = answer_models[task_type]
    answer = answer_model.objects.filter(task=task, user=user).first()

    if not answer:
        return JsonResponse({
            "task_id": task_id,
            "task_type": task_type,
            "answer": None
        })

    return JsonResponse({
        "task_id": task_id,
        "task_type": task_type,
        "answer": answer.get_answer_data()
    })


@require_POST
@login_required
def mark_answer_as_checked(request, classroom_id):
    """
    Помечает ответ как проверенный (для заданий с автоматической проверкой)
    """
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"success": False, "errors": "Invalid JSON"}, status=400)

    task_id = payload.get("task_id")
    user_id = payload.get("user_id")

    if not classroom_id:
        return JsonResponse({"success": False, "errors": "virtual_class_id required"}, status=400)
    if not task_id or not user_id:
        return JsonResponse({"success": False, "errors": "task_id and user_id required"}, status=400)

    task = get_object_or_404(Task, pk=task_id)
    user = get_object_or_404(User, id=user_id)

    classroom = get_object_or_404(Classroom, id=classroom_id)
    #if classroom.teacher != request.user:
    #    return JsonResponse({"success": False, "errors": "Only teacher can mark answers as checked"}, status=403)

    task_type = task.task_type

    answer_models = {
        "test": TestTaskAnswer,
        "true_false": TrueFalseTaskAnswer,
    }

    if task_type not in answer_models:
        return JsonResponse({"success": False, "errors": "Task type does not support manual checking"}, status=400)

    answer_model = answer_models[task_type]
    answer = get_object_or_404(answer_model, task=task, user=user)

    try:
        answer.mark_as_checked()
        return JsonResponse({
            "success": True,
            "answer": answer.get_answer_data()
        })
    except Exception as e:
        return JsonResponse({"success": False, "errors": "Internal server error"}, status=500)

