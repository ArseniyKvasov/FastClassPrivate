from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.shortcuts import get_object_or_404

from courses.services import serialize_task_data
from courses.models import Section, Task, SectionCopy, TaskCopy

User = get_user_model()


def get_single_task_view(request, task_id, copy=False):
    """
    Получение одной задачи.
    Если copy=True — ищем TaskCopy, иначе Task.
    """
    try:
        if copy:
            task = get_object_or_404(TaskCopy, pk=task_id)
        else:
            task = get_object_or_404(Task, pk=task_id)

        serialized_task = {
            "task_id": task.id,
            "task_type": getattr(task, "task_type", None),
            "data": serialize_task_data(task)
        }

        return JsonResponse({"success": True, "task": serialized_task})

    except Exception as e:
        return JsonResponse({"success": False, "errors": str(e)}, status=500)


def get_section_tasks_view(request, section_id, copy=False):
    """
    Получение всех задач раздела.
    Если copy=True — ищем SectionCopy и TaskCopy.
    Иначе — обычный Section и Task.
    """
    try:
        if copy:
            section = get_object_or_404(SectionCopy, pk=section_id)
            tasks = section.tasks.all().order_by("order")
        else:
            section = get_object_or_404(Section, pk=section_id)
            tasks = section.tasks.all().order_by("order")

        serialized_tasks = []
        for t in tasks:
            serialized_tasks.append({
                "task_id": t.id,
                "task_type": getattr(t, "task_type", None),
                "data": serialize_task_data(t)
            })

        return JsonResponse({"success": True, "tasks": serialized_tasks})

    except Exception as e:
        return JsonResponse({"success": False, "errors": str(e)}, status=500)