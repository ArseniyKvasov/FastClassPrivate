from courses.models import Lesson, Section, Task, TestTask, NoteTask, ImageTask, TrueFalseTask, FillGapsTask, \
    MatchCardsTask, \
    TextInputTask
import json
from django.views.decorators.http import require_POST
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from courses.task_serializers import TASK_SERIALIZER_MAP


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
