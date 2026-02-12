from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.shortcuts import get_object_or_404

from courses.models import Section, Task
from courses.services import get_task_data

User = get_user_model()


def get_single_task_view(request, task_id):
    """
    Получение одной задачи Task.
    """
    try:
        try:
            task = Task.objects.get(id=task_id)
        except Task.DoesNotExist:
            return JsonResponse(
                {"success": False, "errors": "Задание не найдено"},
                status=404
            )

        serialized_task = {
            "task_id": task.id,
            "task_type": task.task_type,
            "data": get_task_data(task),
        }

        return JsonResponse({"success": True, "task": serialized_task})

    except Exception as e:
        return JsonResponse(
            {"success": False, "errors": str(e)},
            status=500
        )


def get_section_tasks_view(request, section_id):
    """
    Получение всех задач раздела (Task) с корректным order.
    """
    try:
        section = get_object_or_404(
            Section.objects.select_related("lesson__course"),
            pk=section_id
        )

        tasks = list(Task.objects.filter(section=section).order_by("order"))

        serialized_tasks = [
            {
                "task_id": t.id,
                "task_type": t.task_type,
                "data": get_task_data(t),
            }
            for t in tasks
        ]

        return JsonResponse({"success": True, "tasks": serialized_tasks})

    except Exception as e:
        return JsonResponse(
            {"success": False, "errors": str(e)},
            status=500
        )
