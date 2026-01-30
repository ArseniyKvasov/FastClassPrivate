from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from courses.models import Task
from classroom.models import Classroom
from classroom.services import check_user_access

from classroom.registry import get_all_answer_models

User = get_user_model()


@require_http_methods(["DELETE"])
def delete_user_task_answers(request, classroom_id, task_id, user_id):
    """
    Удаляет ответы конкретного пользователя для конкретного задания в классе
    """
    try:
        classroom = get_object_or_404(Classroom, id=classroom_id)
        task = get_object_or_404(Task, id=task_id)
        user = get_object_or_404(User, id=user_id)

        if not check_user_access(request.user, classroom, user):
            return JsonResponse({"error": "Доступ запрещен"}, status=403)

        deleted_count = 0

        answer_models = get_all_answer_models()

        for answer_model in answer_models:
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
        print(e)
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

        answer_models = get_all_answer_models()

        for student in list(students) + [teacher]:
            user_deleted_types = 0

            for answer_model in answer_models:
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
