from django.contrib.contenttypes.models import ContentType
from django.http import JsonResponse
from django.db import models
from rest_framework import serializers
from courses.models import Section, Task, TestTask, TrueFalseTask, ImageTask
from courses.task_serializers import TASK_SERIALIZER_MAP


def serialize_task_data(task):
    try:
        obj = task.specific
        if task.task_type == "image":
            return {
                "image_url": getattr(obj, "image", None) and obj.image.url,
                "caption": getattr(obj, "caption", "") or ""
            }
        if task.task_type == "fill_gaps":
            return {"text": getattr(obj, "text", ""), "answers": getattr(obj, "answers", [])}
        if task.task_type == "note":
            return {"content": getattr(obj, "content", "")}
        if task.task_type == "true_false":
            statements = getattr(obj, "statements", [])
            return {"statements": [{"statement": s.get("statement", ""), "is_true": s.get("is_true", False)} for s in
                                   statements]}
        if task.task_type == "test":
            questions = getattr(obj, "questions", [])
            return {
                "questions": [{"question": q.get("question", ""), "options": q.get("options", [])} for q in questions]}
        if task.task_type == "match_cards":
            return {"cards": getattr(obj, "cards", []), "shuffled_cards": getattr(obj, "shuffled_cards", [])}
        if task.task_type == "text_input":
            return {"prompt": getattr(obj, "prompt", ""), "default_text": getattr(obj, "default_text", "") or ""}
        if task.task_type == "integration":
            return {"embed_code": getattr(obj, "embed_code", "")}
        return {}
    except Exception as e:
        print("Ошибка сериализации задачи:", e)
        return {}


def _process_task_data(user, section_id, task_type, task_id, data):
    """Основная логика обработки данных задачи"""
    if not section_id:
        return JsonResponse({"success": False, "errors": "Не указан раздел"}, status=400)

    try:
        section = Section.objects.get(pk=section_id)
    except Section.DoesNotExist:
        return JsonResponse({"success": False, "errors": "Раздел не найден"}, status=404)

    if section.lesson.course.creator != user:
        return JsonResponse(
            {"success": False, "errors": "Доступ запрещен. Только создатель курса может редактировать задания"},
            status=403)

    SerializerClass = TASK_SERIALIZER_MAP.get(task_type)
    if not SerializerClass:
        return JsonResponse({"success": False, "errors": f"Unknown task type: {task_type}"}, status=400)

    if task_id:
        return _update_existing_task(task_id, section, SerializerClass, data)
    else:
        return _create_new_task(section, task_type, SerializerClass, data)


def _update_existing_task(task_id, section, SerializerClass, data):
    """Обновляет существующую задачу"""
    try:
        task = Task.objects.get(pk=task_id)
    except Task.DoesNotExist:
        return JsonResponse({"success": False, "errors": "Task not found"}, status=404)

    specific_obj = task.specific
    item = data[0].copy()

    if isinstance(specific_obj, TestTask):
        item = {"questions": data}

    elif isinstance(specific_obj, TrueFalseTask):
        item = {"statements": data}

    elif isinstance(specific_obj, ImageTask) and "image" in item and item["image"] is None:
        item.pop("image")

    serializer = SerializerClass(specific_obj, data=item, partial=True)
    serializer.is_valid(raise_exception=True)
    obj = serializer.save()
    task.section = section
    task.save()

    task.refresh_from_db()

    return JsonResponse({
        "success": True,
        "task_id": task.id,
        "task_type": task.task_type,
        "data": serialize_task_data(task)
    })


def _create_new_task(section, task_type, SerializerClass, data):
    """Создает новую задачу с автоматическим порядком"""
    if task_type == "test":
        task = _create_test_task(section, task_type, SerializerClass, data)
    elif task_type == "true_false":
        task = _create_true_false_task(section, task_type, SerializerClass, data)
    else:
        if len(data) > 1:
            return JsonResponse(
                {"success": False, "errors": "Для данного типа задачи можно создать только одно задание"}, status=400
            )

        serializer = SerializerClass(data=data[0])
        try:
            serializer.is_valid(raise_exception=True)
            obj = serializer.save()

            max_order = section.tasks.aggregate(models.Max("order"))["order__max"] or 0
            task_order = max_order + 1

            task = Task.objects.create(
                section=section,
                task_type=task_type,
                content_type=ContentType.objects.get_for_model(obj),
                object_id=obj.id,
                order=task_order
            )
        except serializers.ValidationError as e:
            return JsonResponse({"success": False, "errors": e.detail}, status=400)

    if isinstance(task, JsonResponse):
        return task

    return JsonResponse({
        "success": True,
        "task_id": task.id,
        "task_type": task.task_type,
        "data": serialize_task_data(task)
    })


def _create_test_task(section, task_type, SerializerClass, data):
    """Создает задачу типа test"""
    serializer = SerializerClass(data={"questions": data})
    try:
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        task = Task.objects.create(
            section=section,
            task_type=task_type,
            content_type=ContentType.objects.get_for_model(obj),
            object_id=obj.id
        )
        return task
    except serializers.ValidationError as e:
        return JsonResponse({"success": False, "errors": e.detail}, status=400)


def _create_true_false_task(section, task_type, SerializerClass, data):
    """Создает задачу типа true_false"""
    serializer = SerializerClass(data={"statements": data})
    try:
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        task = Task.objects.create(
            section=section,
            task_type=task_type,
            content_type=ContentType.objects.get_for_model(obj),
            object_id=obj.id
        )
        return task
    except serializers.ValidationError as e:
        return JsonResponse({"success": False, "errors": e.detail}, status=400)
