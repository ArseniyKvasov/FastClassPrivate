import random

from django.shortcuts import render
from django.contrib.contenttypes.models import ContentType
from rest_framework import serializers
from .models import Lesson, Section, Task, TestTask, NoteTask, ImageTask, TrueFalseTask, FillGapsTask, MatchCardsTask, \
    TextInputTask
import json
from django.views.decorators.http import require_POST
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from .tasks_serializers import TASK_SERIALIZER_MAP


def page_editor_view(request, lesson_id):
    lesson = get_object_or_404(Lesson, pk=lesson_id)

    sections = lesson.sections.order_by("order")  # добавляем список секций
    first_section = sections.first()
    section_id = first_section.id if first_section else None

    return render(
        request,
        "courses/page_editor.html",
        context={
            "lesson_id": lesson.id,
            "sections": sections,
            "section_id": section_id,
            "is_admin": True,
            "room_type": "lesson_editor",
            "current_user_id": request.user.id,
        }
    )

# Создание/редактирование раздела
@require_POST
def create_section_view(request):
    """
    Создание нового раздела для урока.
    Ожидает JSON с полями:
      - lesson_id: UUID урока
      - title: название раздела
    Возвращает JSON с данными созданного раздела.
    """
    try:
        data = json.loads(request.body)
        lesson_id = data.get("lesson_id")
        title = data.get("title", "").strip()

        if not title:
            return JsonResponse({"error": "Название раздела не может быть пустым."}, status=400)

        lesson = get_object_or_404(Lesson, id=lesson_id)
        order = lesson.sections.count()

        section = Section.objects.create(
            lesson=lesson,
            title=title,
            order=order
        )

        return JsonResponse({
            "id": str(section.id),
            "title": section.title,
            "order": section.order,
            "lesson_id": str(lesson.id)
        })

    except json.JSONDecodeError:
        return JsonResponse({"error": "Некорректный формат данных."}, status=400)
    except Lesson.DoesNotExist:
        return JsonResponse({"error": "Урок не найден."}, status=404)
    except Exception as e:
        return JsonResponse({"error": f"Ошибка при создании раздела: {e}"}, status=500)

@require_POST
def edit_section_view(request):
    """
    Редактирование названия раздела
    """
    try:
        data = json.loads(request.body)
        section_id = data.get("section_id")
        new_title = data.get("title", "").strip()

        if not section_id:
            return JsonResponse({"error": "Не указан ID раздела"}, status=400)
        if not new_title:
            return JsonResponse({"error": "Название не может быть пустым"}, status=400)

        section = get_object_or_404(Section, id=section_id)
        section.title = new_title
        section.save()

        return JsonResponse({
            "id": str(section.id),
            "title": section.title
        })

    except json.JSONDecodeError:
        return JsonResponse({"error": "Некорректный формат данных"}, status=400)
    except Exception as e:
        return JsonResponse({"error": f"Ошибка при редактировании раздела: {e}"}, status=500)

@require_POST
def delete_section_view(request):
    """
    Удаление раздела по ID
    """
    try:
        data = json.loads(request.body)
        section_id = data.get("section_id")

        if not section_id:
            return JsonResponse({"error": "Не указан ID раздела"}, status=400)

        section = get_object_or_404(Section, id=section_id)
        section.delete()

        return JsonResponse({"success": True})

    except json.JSONDecodeError:
        return JsonResponse({"error": "Некорректный формат данных"}, status=400)
    except Exception as e:
        return JsonResponse({"error": f"Ошибка при удалении раздела: {e}"}, status=500)




# Создание заданий
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
            return {"statements": [{"statement": s.get("statement", ""), "is_true": s.get("is_true", False)} for s in statements]}
        elif task.task_type == "test":
            questions = getattr(obj, "questions", [])
            return {"questions": [{"question": q.get("question", ""), "options": q.get("options", [])} for q in questions]}
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
    Возвращает JSON с результатом операции и списком созданных/обновлённых задач.
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

    return _process_task_data(section_id, task_type, task_id, data)


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

    return _process_task_data(section_id, task_type, task_id, data)


def _process_task_data(section_id, task_type, task_id, data):
    """Основная логика обработки данных задачи"""
    if not section_id:
        return JsonResponse({"success": False, "errors": "Не указан раздел"}, status=400)

    try:
        section = Section.objects.get(pk=section_id)
    except Section.DoesNotExist:
        return JsonResponse({"success": False, "errors": "Раздел не найден"}, status=404)

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

    return JsonResponse({
        "success": True,
        "count": 1,
        "tasks": [{"task_id": task.id, "task_type": task.task_type}]
    })


def _create_new_task(section, task_type, SerializerClass, data):
    """Создает новую задачу"""
    created_tasks = []
    errors = []

    if task_type == "test":
        result = _create_test_task(section, task_type, SerializerClass, data)
        if isinstance(result, JsonResponse):
            return result
        created_tasks.append(result)
    elif task_type == "true_false":
        result = _create_true_false_task(section, task_type, SerializerClass, data)
        if isinstance(result, JsonResponse):
            return result
        created_tasks.append(result)
    else:
        for item in data:
            serializer = SerializerClass(data=item)
            try:
                serializer.is_valid(raise_exception=True)
                obj = serializer.save()
                task = Task.objects.create(
                    section=section,
                    task_type=task_type,
                    content_type=ContentType.objects.get_for_model(obj),
                    object_id=obj.id
                )
                created_tasks.append(task)
            except serializers.ValidationError as e:
                errors.append(e.detail)

    if errors:
        return JsonResponse({"success": False, "errors": errors}, status=400)

    return JsonResponse({
        "success": True,
        "count": len(created_tasks),
        "tasks": [{"task_id": t.id, "task_type": t.task_type} for t in created_tasks]
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


# Получение заданий
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








