import json

from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST, require_http_methods

from courses.models import Section, Task, TestTask, TrueFalseTask, ImageTask
from courses.tasks_serializers import TASK_SERIALIZER_MAP
from rest_framework.exceptions import ValidationError

from classroom.models import Classroom, TestTaskAnswer, TrueFalseTaskAnswer, FillGapsTaskAnswer, MatchCardsTaskAnswer, \
    TextInputTaskAnswer

User = get_user_model()

answer_models = {
    "test": TestTaskAnswer,
    "true_false": TrueFalseTaskAnswer,
    "fill_gaps": FillGapsTaskAnswer,
    "match_cards": MatchCardsTaskAnswer,
    "text_input": TextInputTaskAnswer,
}


def check_user_access(request, classroom_id, student):
    """
    Проверяет доступ пользователя к классу
    Возвращает True если доступ есть, False при любой ошибке или отсутствии доступа
    """
    try:
        if not request.user.is_authenticated or not student.is_authenticated:
            return False

        classroom = Classroom.objects.get(id=classroom_id)
        available_users = classroom.get_available_users(request.user)

        return request.user in available_users and student in available_users

    except (Classroom.DoesNotExist, Exception):
        return False


def get_section_answers(request):
    """
    Endpoint для получения ответов на все задания раздела

    Принимает параметры: section_id, classroom_id, user_id
    """
    section_id = request.GET.get("section_id")
    classroom_id = request.GET.get("classroom_id")
    user_id = request.GET.get("user_id")

    if not section_id or not classroom_id or not user_id:
        return JsonResponse({"error": "Missing required parameters"}, status=400)

    section = get_object_or_404(Section, id=section_id)
    classroom = get_object_or_404(Classroom, id=classroom_id)
    user = get_object_or_404(User, id=user_id)
    if not check_user_access(request, classroom_id, user):
        return JsonResponse({"error": "Access denied"}, status=403)

    tasks = Task.objects.filter(section=section).select_related('section')

    answers_data = []

    for task in tasks:
        task_type = task.task_type

        if task_type not in answer_models:
            continue

        answer_model = answer_models[task_type]
        answer = answer_model.objects.filter(task=task, user=user, classroom=classroom).first()

        answer_info = {
            "task_id": str(task.id),
            "task_type": task_type,
            "answer": answer.get_answer_data() if answer else None
        }
        answers_data.append(answer_info)

    return JsonResponse({
        "section_id": section_id,
        "section_title": section.title,
        "answers": answers_data
    })


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
    classroom = Classroom.objects.get(id=classroom_id)
    if not check_user_access(request, classroom_id, user):
        return JsonResponse({"error": "Access denied"}, status=403)

    task_type = task.task_type

    if task_type not in answer_models:
        return JsonResponse({"error": "Unknown task type"}, status=400)

    answer_model = answer_models[task_type]
    answer = answer_model.objects.filter(task=task, user=user, classroom=classroom).first()

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
def save_answer(request, classroom_id):
    """
    Основная точка сохранения ответов.

    Принимает JSON-структуру:
        {
            "task_id": "...",
            "data": {...},
            "user_id": "..."
        }
    """
    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"success": False, "errors": "Invalid JSON"}, status=400)

    task_id = payload.get("task_id")
    data = payload.get("data", {})
    user_id = payload.get("user_id")

    if not classroom_id:
        return JsonResponse({"success": False, "errors": "virtual_class_id required"}, status=400)

    user = get_object_or_404(User, id=user_id)

    if not check_user_access(request, classroom_id, user):
        return JsonResponse({"error": "Access denied"}, status=403)
    if not task_id:
        return JsonResponse({"success": False, "errors": "task_id required"}, status=400)

    task = get_object_or_404(Task, pk=task_id)
    classroom = get_object_or_404(Classroom, id=classroom_id)
    task_type = task.task_type

    if task_type not in answer_models:
        return JsonResponse({"success": False, "errors": "Unsupported task type"}, status=400)

    answer_model = answer_models[task_type]

    try:
        answer, created = answer_model.objects.get_or_create(
            task=task,
            user=user,
            classroom=classroom,
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

    print(user_id)

    if not classroom_id:
        return JsonResponse({"success": False, "errors": "virtual_class_id required"}, status=400)
    if not task_id or not user_id:
        return JsonResponse({"success": False, "errors": "task_id and user_id required"}, status=400)

    task = get_object_or_404(Task, pk=task_id)
    user = get_object_or_404(User, id=user_id)
    classroom = get_object_or_404(Classroom, id=classroom_id)

    if not check_user_access(request, classroom_id, user):
        return JsonResponse({"error": "Access denied"}, status=403)

    task_type = task.task_type

    answer_models = {
        "test": TestTaskAnswer,
        "true_false": TrueFalseTaskAnswer,
    }

    if task_type not in answer_models:
        return JsonResponse({"success": False, "errors": "Task type does not support manual checking"}, status=400)

    answer_model = answer_models[task_type]
    answer = get_object_or_404(answer_model, task=task, user=user, classroom=classroom)

    try:
        answer.mark_as_checked()
        return JsonResponse({
            "success": True,
            "answer": answer.get_answer_data()
        })
    except Exception as e:
        return JsonResponse({"success": False, "errors": "Internal server error"}, status=500)


@require_http_methods(["DELETE"])
def delete_user_task_answers(request, classroom_id, task_id, user_id):
    """
    Удаляет ответы конкретного пользователя для конкретного задания в классе
    """
    try:
        classroom = get_object_or_404(Classroom, id=classroom_id)
        task = get_object_or_404(Task, id=task_id)
        user = get_object_or_404(User, id=user_id)

        if not check_user_access(request, classroom_id, user):
            return JsonResponse({"error": "Access denied"}, status=403)

        deleted_count = 0

        answer_types = [
            TestTaskAnswer,
            TrueFalseTaskAnswer,
            FillGapsTaskAnswer,
            MatchCardsTaskAnswer,
            TextInputTaskAnswer
        ]

        for answer_model in answer_types:
            try:
                answer = answer_model.objects.filter(
                    classroom=classroom,
                    task=task,
                    user=user
                ).first()

                if answer:
                    answer.delete_answers()
                    deleted_count += 1

            except answer_model.DoesNotExist:
                continue
            except Exception as e:
                pass

        return JsonResponse({
            'success': True,
            'message': f'Удалено ответов из {deleted_count} типов заданий',
            'deleted_types': deleted_count
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


@require_http_methods(["DELETE"])
def delete_classroom_task_answers(request, classroom_id, task_id):
    """
    Удаляет ответы всех пользователей класса для конкретного задания
    """
    try:
        classroom = get_object_or_404(Classroom, id=classroom_id)
        task = get_object_or_404(Task, id=task_id)

        deleted_users = 0
        total_deleted_types = 0

        students = classroom.students.all()
        teacher = classroom.teacher

        answer_types = [
            TestTaskAnswer,
            TrueFalseTaskAnswer,
            FillGapsTaskAnswer,
            MatchCardsTaskAnswer,
            TextInputTaskAnswer
        ]

        for student in  list(students) + [teacher]:
            user_deleted_types = 0

            for answer_model in answer_types:
                try:
                    answer = answer_model.objects.filter(
                        classroom=classroom,
                        task=task,
                        user=student
                    ).first()

                    if answer:
                        answer.delete_answers()
                        user_deleted_types += 1
                        total_deleted_types += 1

                except answer_model.DoesNotExist:
                    continue
                except Exception as e:
                    pass

            if user_deleted_types > 0:
                deleted_users += 1

        print(deleted_users, total_deleted_types)
        return JsonResponse({
            'success': True,
            'message': f'Удалены ответы для {deleted_users} пользователей',
            'deleted_users': deleted_users,
            'total_deleted_types': total_deleted_types
        })

    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)
