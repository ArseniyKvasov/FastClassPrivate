import json
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.shortcuts import get_object_or_404
from django.db import transaction
from courses.models import Section, Task
from courses.services import TaskProcessor

User = get_user_model()


@require_POST
def save_task(request):
    """
    Универсальный эндпоинт для сохранения задач.
    """
    try:
        if request.content_type.startswith("multipart/form-data"):
            return _handle_multipart_request(request)
        elif request.content_type == "application/json":
            return _handle_json_request(request)
        else:
            return JsonResponse({
                "success": False,
                "errors": "Неподдерживаемый Content-Type"
            }, status=400)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "errors": "Внутренняя ошибка сервера"
        }, status=500)


def _handle_multipart_request(request):
    """
    Обработка multipart/form-data запросов.
    """
    section_id = request.POST.get("section_id")
    task_type = request.POST.get("task_type")
    task_id = request.POST.get("task_id")

    if task_type == 'file':
        data = [{
            "file": request.FILES.get("file"),
            "caption": request.POST.get("caption", "")
        }]
    else:
        try:
            data_json = request.POST.get("data", "[]")
            data = json.loads(data_json)
            if not isinstance(data, list):
                data = [data]
        except json.JSONDecodeError:
            return JsonResponse({
                "success": False,
                "errors": "Некорректный JSON в поле data"
            }, status=400)

    processor = TaskProcessor(
        user=request.user,
        section_id=section_id,
        task_type=task_type,
        task_id=task_id,
        raw_data=data
    )
    return processor.process()


def _handle_json_request(request):
    """
    Обработка application/json запросов.
    """
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({
            "success": False,
            "errors": "Некорректный JSON"
        }, status=400)

    section_id = payload.get("section_id")
    task_type = payload.get("task_type")
    task_id = payload.get("task_id")
    data = payload.get("data", [])

    processor = TaskProcessor(
        user=request.user,
        section_id=section_id,
        task_type=task_type,
        task_id=task_id,
        raw_data=data
    )
    return processor.process()


@require_POST
def delete_task(request):
    """
    Удаление задачи.
    """
    try:
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({
                "success": False,
                "errors": "Некорректный JSON"
            }, status=400)

        task_id = payload.get("task_id")
        if not task_id:
            return JsonResponse({
                "success": False,
                "errors": "Не указан task_id"
            }, status=400)

        try:
            task = Task.objects.select_related(
                'section__lesson__course'
            ).get(id=task_id)
        except Task.DoesNotExist:
            return JsonResponse({
                "success": False,
                "errors": "Задание не найдено"
            }, status=404)

        if task.section.lesson.course.creator != request.user:
            return JsonResponse({
                "success": False,
                "errors": "Нет прав на удаление"
            }, status=403)

        task.delete()

        return JsonResponse({"success": True})

    except Exception as e:
        return JsonResponse({
            "success": False,
            "errors": str(e)
        }, status=500)


@require_POST
def reorder_tasks(request):
    """
    Изменение порядка задач.
    """
    try:
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({
                "status": "error",
                "message": "Некорректный JSON"
            }, status=400)

        section_id = data.get("section_id")
        task_ids = data.get("task_ids", [])

        if not section_id or not isinstance(task_ids, list):
            return JsonResponse({
                "status": "error",
                "message": "Некорректные данные"
            }, status=400)

        section = get_object_or_404(
            Section.objects.select_related("lesson__course"),
            id=section_id
        )

        if section.lesson.course.creator != request.user:
            return JsonResponse({
                "status": "error",
                "message": "Нет прав"
            }, status=403)

        with transaction.atomic():
            tasks = Task.objects.filter(
                id__in=task_ids,
                section=section
            )

            task_dict = {str(task.id): task for task in tasks}

            for index, task_id in enumerate(task_ids):
                task = task_dict.get(str(task_id))
                if task:
                    task.order = index + 1
                    task.save(update_fields=["order"])

        return JsonResponse({"status": "ok"})

    except Exception as e:
        return JsonResponse({
            "status": "error",
            "message": str(e)
        }, status=500)