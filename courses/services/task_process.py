import os
import uuid

from django.contrib.contenttypes.models import ContentType
from django.db import models
from datetime import datetime
from django.http import JsonResponse
from rest_framework import serializers
from django.core.files.storage import default_storage

from courses.models import Section, Task, TestTask, TrueFalseTask, ImageTask
from courses.task_serializers import TASK_SERIALIZER_MAP

from fastlesson import settings


def serialize_task_data(task: Task):
    """
    Сериализация задачи с учётом edited_content.
    Если задача является копией (root_type='copy'), накладываются изменения из edited_content.
    """
    obj = getattr(task, "specific", None)
    data = {}
    is_copy_task = task.root_type == "copy"

    if obj:
        if task.task_type == "image":
            data = {
                "file_path": getattr(obj, "file_path", None),
                "caption": getattr(obj, "caption", "") or "",
            }
        elif task.task_type == "fill_gaps":
            data = {
                "text": getattr(obj, "text", ""),
                "answers": getattr(obj, "answers", []) if getattr(obj, "list_type", "open") == "open" else [],
                "list_type": getattr(obj, "list_type", "open")
            }
        elif task.task_type == "note":
            data = {"content": getattr(obj, "content", "")}
        elif task.task_type == "true_false":
            statements = getattr(obj, "statements", [])
            data = [{"statement": s.get("statement", ""), "is_true": s.get("is_true", False)} for s in statements]
            data = {"statements": data}
        elif task.task_type == "test":
            questions = getattr(obj, "questions", [])
            data = {
                "questions": [{"question": q.get("question", ""), "options": q.get("options", [])} for q in questions]}
        elif task.task_type == "match_cards":
            data = {"cards": getattr(obj, "cards", []), "shuffled_cards": getattr(obj, "shuffled_cards", [])}
        elif task.task_type == "text_input":
            data = {"prompt": getattr(obj, "prompt", ""), "default_text": getattr(obj, "default_text", "") or ""}
        elif task.task_type == "integration":
            data = {"embed_code": getattr(obj, "embed_code", "")}
        elif task.task_type == "file":
            data = {"file_link": getattr(obj, "file_link", "")}
        elif task.task_type == "word_list":
            data = {"words": getattr(obj, "words", [])}

    if is_copy_task and task.edited_content:
        data.update(task.edited_content)

    return data


def _save_image_file(file_obj) -> str:
    """
    Сохраняет файл и возвращает URL для браузера.
    В имя файла добавляется временная метка с датой и временем.
    """
    if not file_obj:
        return None

    ext = os.path.splitext(file_obj.name)[1]
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = f"tasks/images/{uuid.uuid4().hex}_{timestamp}{ext}"

    saved_path = default_storage.save(file_name, file_obj)

    return f"{settings.MEDIA_URL}{saved_path}".replace("\\", "/")


def _process_task_data(user, section_id, task_type, task_id, data):
    """
    Создание или обновление задачи с учётом edited_content и file_path.
    """
    if not section_id:
        return JsonResponse({"success": False, "errors": "Не указан раздел"}, status=400)

    try:
        section = Section.objects.get(pk=section_id)
    except Section.DoesNotExist:
        return JsonResponse({"success": False, "errors": "Раздел не найден"}, status=404)

    course = section.lesson.course
    if not course or course.creator != user:
        return JsonResponse(
            {"success": False, "errors": "Доступ запрещен. Только создатель курса может редактировать задания"},
            status=403
        )

    SerializerClass = TASK_SERIALIZER_MAP.get(task_type)
    if not SerializerClass:
        return JsonResponse({"success": False, "errors": f"Неизвестный тип задания: {task_type}"}, status=400)

    if task_id:
        return _update_existing_task(task_id, section, SerializerClass, data)
    else:
        return _create_new_task(section, task_type, SerializerClass, data)


def _update_existing_task(task_id, section, serializer_class, data):
    try:
        task = Task.objects.get(id=task_id)
    except Task.DoesNotExist:
        return JsonResponse({"success": False, "errors": "Task not found"}, status=404)

    if task.section_id != section.id:
        return JsonResponse({"success": False, "errors": "Неверный раздел"}, status=400)

    specific_obj = getattr(task, "specific", None)
    is_copy_task = task.root_type == "copy"
    item = data[0].copy() if isinstance(data, list) and data else data

    if isinstance(specific_obj, ImageTask):
        file_obj = item.pop("file", None)
        if file_obj:
            specific_obj.file_path = _save_image_file(file_obj)

        specific_obj.caption = item.get("caption", specific_obj.caption or "")
        specific_obj.save()

    elif is_copy_task:
        task.edited_content = item
        task.save(update_fields=["edited_content"])

    elif specific_obj:
        serializer = serializer_class(specific_obj, data=item, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

    return JsonResponse({
        "success": True,
        "task_id": str(task.id),
        "task_type": task.task_type,
        "data": serialize_task_data(task),
    })


def _create_new_task(section, task_type, serializer_class, data):
    item = data[0].copy() if isinstance(data, list) and data else data

    if task_type == "test":
        return _create_test_task(section, serializer_class, data)
    if task_type == "true_false":
        return _create_true_false_task(section, serializer_class, data)

    if isinstance(data, list) and len(data) > 1:
        return JsonResponse(
            {"success": False, "errors": "Для данного типа задачи можно создать только одно задание"},
            status=400,
        )

    if task_type == "image":
        file_obj = item.pop("file", None)
        file_path = _save_image_file(file_obj) if file_obj else None
        item["file_path"] = file_path

    obj = serializer_class(data=item)
    obj.is_valid(raise_exception=True)
    specific_obj = obj.save()

    task = Task.objects.create(
        section=section,
        task_type=task_type,
        root_type="original",
        content_type=ContentType.objects.get_for_model(specific_obj),
        object_id=specific_obj.id,
        edited_content={},
    )

    return JsonResponse({
        "success": True,
        "task_id": str(task.id),
        "task_type": task.task_type,
        "data": serialize_task_data(task),
    })


def _create_test_task(section, serializer_class, data):
    obj = serializer_class(data={"questions": data})
    obj.is_valid(raise_exception=True)
    specific_obj = obj.save()

    task = Task.objects.create(
        section=section,
        task_type="test",
        root_type="original",
        content_type=ContentType.objects.get_for_model(specific_obj),
        object_id=specific_obj.id,
        edited_content={},
    )

    return JsonResponse({
        "success": True,
        "task_id": str(task.id),
        "task_type": task.task_type,
        "data": serialize_task_data(task),
    })


def _create_true_false_task(section, serializer_class, data):
    obj = serializer_class(data={"statements": data})
    obj.is_valid(raise_exception=True)
    specific_obj = obj.save()

    task = Task.objects.create(
        section=section,
        task_type="true_false",
        root_type="original",
        content_type=ContentType.objects.get_for_model(specific_obj),
        object_id=specific_obj.id,
        edited_content={},
    )

    return JsonResponse({
        "success": True,
        "task_id": str(task.id),
        "task_type": task.task_type,
        "data": serialize_task_data(task),
    })