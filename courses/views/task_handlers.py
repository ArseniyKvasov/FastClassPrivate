import json
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.shortcuts import get_object_or_404
from django.db import transaction
from courses.models import Section, Task, SectionCopy, TaskCopy
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
        task = Task.objects.filter(pk=task_id).first()
        if not task:
            return JsonResponse({"success": False, "errors": "Задание не найдено"}, status=404)
        if task.section.lesson.course.creator != request.user:
            return JsonResponse({"success": False, "errors": "Вы не являетесь создателем курса"}, status=403)
        specific_obj = getattr(task, "specific", None)
        if specific_obj:
            specific_obj.delete()
        task.delete()
        return JsonResponse({"success": True, "message": "Задание удалено"})
    except Exception as e:
        return JsonResponse({"success": False, "errors": str(e)}, status=500)


@require_POST
def reorder_tasks(request):
    try:
        data = json.loads(request.body)
        section_id = data.get("section_id")
        task_ids = data.get("task_ids", [])
        section = get_object_or_404(Section, id=section_id)
        with transaction.atomic():
            for index, task_id in enumerate(task_ids):
                task = Task.objects.filter(id=task_id, section=section).first()
                if task:
                    task.order = index + 1
                    task.save(update_fields=["order"])
        return JsonResponse({"status": "ok"})
    except json.JSONDecodeError:
        return JsonResponse({"status": "error", "message": "Некорректный JSON"}, status=400)
    except Section.DoesNotExist:
        return JsonResponse({"status": "error", "message": "Раздел не найден"}, status=404)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)