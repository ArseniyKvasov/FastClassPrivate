from courses.models import Lesson, Section, Task, TestTask, NoteTask, ImageTask, TrueFalseTask, FillGapsTask, \
    MatchCardsTask, \
    TextInputTask
import json
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from courses.task_serializers import TASK_SERIALIZER_MAP


@login_required
def lesson_sections(request, lesson_id):
    """
    Возвращает список разделов для указанного урока.
    Формат: { success: True, sections: [ {id, title, order}, ... ] }
    """
    lesson = get_object_or_404(Lesson, id=lesson_id)

    sections_qs = lesson.sections.all().order_by('order')

    sections = [
        {
            "id": str(section.id),
            "title": section.title,
            "order": section.order,
        }
        for section in sections_qs
    ]

    return JsonResponse({"success": True, "sections": sections})


@require_POST
def create_section(request):
    """
    Создание нового раздела.
    Ожидает JSON:
      - lesson_id
      - title
    """
    try:
        data = json.loads(request.body)
        lesson_id = data.get("lesson_id")
        title = (data.get("title") or "").strip()

        if not lesson_id:
            return JsonResponse({"error": "Не указан lesson_id"}, status=400)

        if not title:
            return JsonResponse({"error": "Название раздела не может быть пустым"}, status=400)

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
            "order": section.order
        })

    except json.JSONDecodeError:
        return JsonResponse({"error": "Некорректный JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_POST
def edit_section(request, section_id):
    """
    Редактирование названия раздела
    URL: /section/<section_id>/edit/
    """
    try:
        data = json.loads(request.body)
        title = (data.get("title") or "").strip()

        if not title:
            return JsonResponse({"error": "Название не может быть пустым"}, status=400)

        section = get_object_or_404(Section, id=section_id)
        section.title = title
        section.save(update_fields=["title"])

        return JsonResponse({
            "id": str(section.id),
            "title": section.title
        })

    except json.JSONDecodeError:
        return JsonResponse({"error": "Некорректный JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@require_POST
def delete_section(request, section_id):
    """
    Удаление раздела
    URL: /section/<section_id>/delete/
    """
    try:
        section = get_object_or_404(Section, id=section_id)
        section.delete()

        return JsonResponse({"success": True})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
