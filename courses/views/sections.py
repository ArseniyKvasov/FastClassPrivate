from courses.models import Lesson, Section, Task
import json
from django.db import transaction
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from courses.task_serializers import TASK_SERIALIZER_MAP


@login_required
def lesson_sections(request, lesson_id):
    """
    Возвращает список разделов урока (оригинал или копия)
    """
    lesson = get_object_or_404(Lesson, id=lesson_id)
    sections_qs = lesson.sections.all().order_by("order")

    if not sections_qs.exists():
        with transaction.atomic():
            Section.objects.create(
                lesson=lesson,
                title="Новый раздел",
                order=1,
            )
            sections_qs = lesson.sections.all().order_by("order")

    sections = [
        {
            "id": section.id,
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

        if request.user != lesson.course.creator:
            return JsonResponse({"error": "Доступ запрещен."}, status=403)

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
@login_required
def reorder_sections(request, lesson_id):
    """
    Меняет порядок разделов
    """
    try:
        payload = json.loads(request.body.decode("utf-8"))
        order = payload.get("order", [])
    except Exception:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    if not isinstance(order, list):
        return JsonResponse({"error": "Order must be a list"}, status=400)

    lesson = get_object_or_404(
        Lesson,
        id=lesson_id,
        course__creator=request.user,
    )

    if lesson.course.creator != request.user:
        return JsonResponse({"error": "Ошибка доступа."}, status=403)

    qs = lesson.sections.select_for_update()

    with transaction.atomic():
        sections = {str(s.id): s for s in qs}

        for index, section_id in enumerate(order):
            section = sections.get(str(section_id))
            if not section:
                continue

            if section.order != index:
                section.order = index
                section.save(update_fields=["order"])

    return JsonResponse({"status": "ok"})


@require_POST
@login_required
def edit_section(request, section_id):
    """
    Редактирование раздела
    """
    try:
        data = json.loads(request.body)
        title = (data.get("title") or "").strip()

        if not title:
            return JsonResponse({"error": "Название не может быть пустым"}, status=400)

        section = get_object_or_404(Section, id=section_id)

        if section.lesson.course.creator != request.user:
            return JsonResponse({"error": "Ошибка доступа."}, status=403)

        section.title = title
        section.save(update_fields=["title"])

        return JsonResponse({
            "id": section.id,
            "title": section.title,
        })

    except json.JSONDecodeError:
        return JsonResponse({"error": "Некорректный JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)



@require_POST
@login_required
def delete_section(request, section_id):
    """
    Удаление раздела
    """
    section = get_object_or_404(Section, id=section_id)
    sections_count = Section.objects.filter(lesson=section.lesson).count()

    if section.lesson.course.creator != request.user:
        return JsonResponse({"error": "Ошибка доступа."}, status=403)

    if sections_count <= 1:
        return JsonResponse(
            {
                "success": False,
                "error": "Нельзя удалить единственный раздел в уроке",
            },
            status=400,
        )

    section.delete()
    return JsonResponse({"success": True})

