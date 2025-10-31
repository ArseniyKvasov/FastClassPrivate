from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.contrib.contenttypes.models import ContentType
from django.views.decorators.http import require_POST
from rest_framework import serializers
import json
from . import serializers
from .models import Lesson, Section, Task, TestTask, NoteTask, ImageTask, TrueFalseTask, FillGapsTask, MatchCardsTask, \
    TextInputTask
from .serializers import TASK_SERIALIZER_MAP


def page_editor_view(request, lesson_id):
    lesson = get_object_or_404(Lesson, pk=lesson_id)
    first_section = lesson.sections.order_by("order").first()
    section_id = first_section.id if first_section else None

    # Берём все задания для этого раздела
    tasks = []
    if first_section:
        tasks = first_section.tasks.select_related("content_type").all()

    return render(
        request,
        "courses/page_editor.html",
        context={
            "lesson_id": lesson.id,
            "section_id": section_id,
            "tasks": tasks,
            "is_admin": True,
        }
    )


@require_POST
def save_task(request):
    try:
        # --- 1. Получаем section_id ---
        section_id = request.POST.get("section_id") or json.loads(request.body).get("section_id")
        if not section_id:
            return JsonResponse({
                "success": False,
                "errors": "Не указан раздел"
            }, status=400)

        try:
            section = Section.objects.get(pk=section_id)
        except Section.DoesNotExist:
            return JsonResponse({
                "success": False,
                "errors": "Раздел не найден"
            }, status=404)

        # --- 2. Проверка авторства курса ---
        # if section.lesson.course.creator != request.user:
        #     return JsonResponse({"success": False, "errors": "Вы не являетесь создателем курса"}, status=403)

        # --- 3. Получение данных задания ---
        if request.FILES.get("image"):
            task_type = request.POST.get("task_type")
            task_id = request.POST.get("task_id")
            file = request.FILES["image"]

            if file.size > 5 * 1024 * 1024:
                return JsonResponse(
                    {"success": False, "errors": "Файл не должен превышать 5 МБ"},
                    status=400
                )

            data = [{"image": file, "caption": request.POST.get("caption", "")}]
        else:
            try:
                payload = json.loads(request.body)
            except json.JSONDecodeError:
                return JsonResponse(
                    {"success": False, "errors": "Invalid JSON"},
                    status=400
                )

            task_type = payload.get("task_type")
            task_id = payload.get("task_id")
            data = payload.get("data", [])
            if not isinstance(data, list):
                data = [data]

        SerializerClass = TASK_SERIALIZER_MAP.get(task_type)
        if not SerializerClass:
            return JsonResponse(
                {"success": False, "errors": f"Unknown task type: {task_type}"},
                status=400
            )

        created_tasks = []
        errors = []

        # --- 4. Обновление или создание ---
        if task_id:
            try:
                task = Task.objects.get(pk=task_id)
            except Task.DoesNotExist:
                return JsonResponse({"success": False, "errors": "Task not found"}, status=404)

            specific_obj = task.specific
            serializer = SerializerClass(specific_obj, data=data[0], partial=True)
            serializer.is_valid(raise_exception=True)
            obj = serializer.save()
            task.section = section
            task.save()
            created_tasks.append(task)
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

    except Exception as e:
        return JsonResponse({"success": False, "errors": str(e)}, status=500)

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


def serialize_task_data(task):
    try:
        obj = task.specific
        if task.task_type == "image":
            return {
                "image_url": obj.image.url if obj.image else None,
                "caption": obj.caption or ""
            }
        elif task.task_type == "fill_gaps":
            return {
                "text": obj.text,
                "answers": obj.answers,
                "task_type": obj.task_type
            }
        elif task.task_type == "note":
            return {"content": obj.content}
        elif task.task_type == "true_false":
            return {"statement": obj.statement, "is_true": obj.is_true}
        elif task.task_type == "test":
            return {"question": obj.question, "options": obj.options}
        elif task.task_type == "match_cards":
            return {"cards": obj.cards}
        elif task.task_type == "text_input":
            return {
                "prompt": obj.prompt,
                "default_text": obj.default_text or ""
            }
        else:
            return {}
    except Exception as e:
        print("Ошибка сериализации задачи:", e)
        return {}


def get_tasks_view(request, section_id):
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
