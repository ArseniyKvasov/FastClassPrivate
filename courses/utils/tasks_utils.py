import json

from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_POST
from rest_framework import serializers

from courses.models import Section, Task, TestTask, TrueFalseTask, ImageTask
from courses.tasks_serializers import TASK_SERIALIZER_MAP

from classroom.models import Classroom, TestTaskAnswer, TrueFalseTaskAnswer, FillGapsTaskAnswer, MatchCardsTaskAnswer, \
    TextInputTaskAnswer

User = get_user_model()


def get_section_tasks_view(request, section_id):
    try:
        section = get_object_or_404(Section, pk=section_id)
        tasks = section.tasks.all().order_by("created_at")

        serialized_tasks = []
        for t in tasks:
            serialized_tasks.append({
                "task_id": t.id,
                "task_type": t.task_type,
                "data": serialize_task_data(t)
            })

        return JsonResponse({"success": True, "tasks": serialized_tasks})
    except Exception as e:
        return JsonResponse({"success": False, "errors": str(e)}, status=500)


def get_single_task_view(request, task_id):
    try:
        task = get_object_or_404(Task, pk=task_id)
        serialized_task = {
            "task_id": task.id,
            "task_type": task.task_type,
            "data": serialize_task_data(task)
        }

        return JsonResponse({"success": True, "task": serialized_task})
    except Exception as e:
        return JsonResponse({"success": False, "errors": str(e)}, status=500)


def serialize_task_data(task):
    """
    Возвращает корректные данные задачи для фронтенда в зависимости от типа задачи.
    Для 'test' и 'true_false' поддерживает массивы вопросов/утверждений.
    """
    try:
        obj = task.specific
        if task.task_type == "image":
            return {
                "image_url": obj.image.url if getattr(obj, "image", None) else None,
                "caption": getattr(obj, "caption", "") or ""
            }
        elif task.task_type == "fill_gaps":
            return {
                "text": getattr(obj, "text", ""),
                "answers": getattr(obj, "answers", []),
                "task_type": getattr(obj, "task_type", "")
            }
        elif task.task_type == "note":
            return {"content": getattr(obj, "content", "")}
        elif task.task_type == "true_false":
            statements = getattr(obj, "statements", [])
            return {"statements": [{"statement": s.get("statement", ""), "is_true": s.get("is_true", False)} for s in
                                   statements]}
        elif task.task_type == "test":
            questions = getattr(obj, "questions", [])
            return {
                "questions": [{"question": q.get("question", ""), "options": q.get("options", [])} for q in questions]}
        elif task.task_type == "match_cards":
            return {
                "cards": getattr(obj, "cards", []),
                "shuffled_cards": getattr(obj, "shuffled_cards", [])
            }
        elif task.task_type == "text_input":
            return {
                "prompt": getattr(obj, "prompt", ""),
                "default_text": getattr(obj, "default_text", "") or ""
            }
        elif task.task_type == "integration":
            return {
                "embed_code": getattr(obj, "embed_code", "")
            }
        else:
            return {}
    except Exception as e:
        print("Ошибка сериализации задачи:", e)
        return {}


@require_POST
def save_task(request):
    """
    Обрабатывает POST-запрос на создание или обновление задачи.
    Поддерживает типы задач: тесты, заметки, изображения, правда/ложь, заполнить пропуски, карточки, ввод текста.
    Для тестов объединяет все вопросы в один объект TestTask.
    Возвращает JSON с результатом операции и данными созданной/обновлённой задачи.
    """
    try:
        if request.content_type.startswith("multipart/form-data"):
            return _handle_multipart_request(request)
        elif request.content_type == "application/json":
            return _handle_json_request(request)
        else:
            return JsonResponse({"success": False, "errors": "Unsupported content type"}, status=400)

    except Exception as e:
        print(e)
        return JsonResponse({"success": False, "errors": str(e)}, status=500)


def _handle_multipart_request(request):
    """Обрабатывает multipart/form-data запросы (изображения)"""
    section_id = request.POST.get("section_id")
    task_type = request.POST.get("task_type")
    task_id = request.POST.get("task_id")
    file = request.FILES.get("image")
    caption = request.POST.get("caption", "")

    item = {}
    if file:
        item["image"] = file
    item["caption"] = caption
    data = [item]

    return _process_task_data(request, section_id, task_type, task_id, data)


def _handle_json_request(request):
    """Обрабатывает application/json запросы"""
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

    return _process_task_data(request, section_id, task_type, task_id, data)


def _process_task_data(request, section_id, task_type, task_id, data):
    """Основная логика обработки данных задачи"""
    if not section_id:
        return JsonResponse({"success": False, "errors": "Не указан раздел"}, status=400)

    try:
        section = Section.objects.get(pk=section_id)
    except Section.DoesNotExist:
        return JsonResponse({"success": False, "errors": "Раздел не найден"}, status=404)

    if section.lesson.course.creator != request.user:
        return JsonResponse({"success": False, "errors": "Доступ запрещен. Только создатель курса может редактировать задания"}, status=403)

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

    elif isinstance(specific_obj, ImageTask) and item.get("image"):
        if specific_obj.image:
            specific_obj.image.delete(save=False)
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
    """Создает новую задачу"""
    if task_type == "test":
        task = _create_test_task(section, task_type, SerializerClass, data)
    elif task_type == "true_false":
        task = _create_true_false_task(section, task_type, SerializerClass, data)
    else:
        if len(data) > 1:
            return JsonResponse(
                {"success": False, "errors": "Для данного типа задачи можно создать только одно задание"}, status=400)

        serializer = SerializerClass(data=data[0])
        try:
            serializer.is_valid(raise_exception=True)
            obj = serializer.save()
            task = Task.objects.create(
                section=section,
                task_type=task_type,
                content_type=ContentType.objects.get_for_model(obj),
                object_id=obj.id
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
            task = Task.objects.get(pk=task_id)
        except Task.DoesNotExist:
            return JsonResponse({"success": False, "errors": "Задание не найдено"}, status=404)

        # --- Проверка авторства (опционально) ---
        # if task.section.lesson.course.creator != request.user:
        #     return JsonResponse({"success": False, "errors": "Вы не являетесь создателем курса"}, status=403)

        # --- Удаляем связанный объект specific ---
        specific_obj = task.specific
        if specific_obj:
            specific_obj.delete()  # для ImageTask файл будет удалён, если delete переопределён

        # --- Удаляем сам Task ---
        task.delete()

        return JsonResponse({"success": True, "message": "Задание удалено"})
    except Exception as e:
        return JsonResponse({"success": False, "errors": str(e)}, status=500)
