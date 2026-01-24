import json
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.shortcuts import get_object_or_404
from django.db import transaction
from courses.models import Section, Task
from courses.task_serializers import TASK_SERIALIZER_MAP
from courses.services import _process_task_data

User = get_user_model()


@require_POST
def save_task(request):
    try:
        if request.content_type.startswith("multipart/form-data"):
            return _handle_multipart_request(request)
        elif request.content_type == "application/json":
            return _handle_json_request(request)
        else:
            return JsonResponse({"success": False, "errors": "Unsupported content type"}, status=400)
    except Exception as e:
        return JsonResponse({"success": False, "errors": str(e)}, status=500)


def _handle_multipart_request(request):
    section_id = request.POST.get("section_id")
    task_type = request.POST.get("task_type")
    task_id = request.POST.get("task_id")
    file = request.FILES.get("file")
    caption = request.POST.get("caption", "")
    item = {}
    if file:
        item["file"] = file
    item["caption"] = caption
    data = [item]
    return _process_task_data(request.user, section_id, task_type, task_id, data)


def _handle_json_request(request):
    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "errors": "Invalid JSON"}, status=400)

    section_id = payload.get("section_id")
    task_type = payload.get("task_type")
    task_id = payload.get("task_id")
    data = payload.get("data", [])
    if not isinstance(data, list):
        data = [data]

    return _process_task_data(request.user, section_id, task_type, task_id, data)


@require_POST
def delete_task(request):
    try:
        try:
            payload = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "errors": "Invalid JSON"}, status=400)

        task_id = payload.get("task_id")
        if not task_id:
            return JsonResponse({"success": False, "errors": "Не указан task_id"}, status=400)

        try:
            task = Task.objects.get(id=task_id)
        except Task.DoesNotExist:
            return JsonResponse({"success": False, "errors": "Задание не найдено"}, status=404)

        course = task.section.lesson.course
        if course.creator != request.user:
            return JsonResponse({"success": False, "errors": "Нет прав на удаление"}, status=403)

        task.delete()
        return JsonResponse({"success": True})

    except Exception as e:
        return JsonResponse({"success": False, "errors": str(e)}, status=500)


@require_POST
def reorder_tasks(request):
    try:
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"status": "error", "message": "Некорректный JSON"}, status=400)

        section_id = data.get("section_id")
        task_ids = data.get("task_ids", [])

        if not section_id or not isinstance(task_ids, list):
            return JsonResponse({"status": "error", "message": "Некорректные данные"}, status=400)

        section = get_object_or_404(
            Section.objects.select_related("lesson__course"),
            id=section_id
        )

        if section.lesson.course.creator != request.user:
            return JsonResponse({"status": "error", "message": "Нет прав"}, status=403)

        with transaction.atomic():
            for index, task_id in enumerate(task_ids):
                try:
                    task = Task.objects.get(id=task_id)
                except Task.DoesNotExist:
                    continue

                if task.section_id != section.id:
                    continue

                task.order = index + 1
                task.save(update_fields=["order"])

        return JsonResponse({"status": "ok"})

    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)
