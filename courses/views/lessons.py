import json

from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import F
from django.db.models import Max
from django.http import HttpResponseForbidden
from django.shortcuts import render, get_object_or_404
from django.views.decorators.clickjacking import xframe_options_exempt
from django.db.models.deletion import ProtectedError
from courses.models import Lesson, Course


@login_required
@require_POST
def create_lesson(request, course_id):
    title = request.POST.get("title", "").strip()
    description = request.POST.get("description", "").strip()

    if not title:
        return JsonResponse({"error": "title обязательное поле"}, status=400)

    if len(title) > 30:
        return JsonResponse(
            {"error": "Название класса не должно превышать 30 символов"},
            status=400
        )

    if not course_id:
        return JsonResponse({"error": "course_id обязательное поле"}, status=400)

    try:
        course = Course.objects.get(id=course_id)
    except Course.DoesNotExist:
        return JsonResponse({"error": "Курс не найден"}, status=404)

    if course.creator != request.user:
        return JsonResponse({"error": "Доступ запрещен"}, status=403)

    last_order = course.lessons.aggregate(max_order=Max('order'))['max_order'] or 0
    new_order = last_order + 1

    lesson = Lesson.objects.create(
        course=course,
        title=title,
        description=description,
        order=new_order
    )

    return JsonResponse({
        "created": {
            "id": lesson.id,
            "title": lesson.title,
            "description": lesson.description
        }
    })


@login_required
@require_POST
def edit_lesson(request, lesson_id):
    title = request.POST.get("title", "").strip()
    description = request.POST.get("description", "").strip()

    if not title:
        return JsonResponse({"error": "title обязательное поле"}, status=400)

    try:
        lesson = Lesson.objects.get(id=lesson_id)
    except Lesson.DoesNotExist:
        return JsonResponse({"error": "Урок не найден"}, status=404)

    if lesson.course.creator != request.user:
        return JsonResponse({"error": "Доступ запрещен"}, status=403)

    lesson.title = title
    lesson.description = description
    lesson.save()

    return JsonResponse({
        "updated": {
            "title": lesson.title,
            "description": lesson.description
        }
    })


@login_required
@require_POST
def delete_lesson(request, lesson_id):
    try:
        lesson = Lesson.objects.get(id=lesson_id)
    except Lesson.DoesNotExist:
        return JsonResponse({"error": "Урок не найден"}, status=404)

    try:
        lesson.delete()
    except ProtectedError:
        return JsonResponse({"error": "Вы не можете удалить урок, который используют другие пользователи"}, status=400)

    return JsonResponse({"deleted": True})


@login_required
@require_POST
def reorder_lessons(request, course_id):
    try:
        data = json.loads(request.body)
        order = data.get('order', [])

        if not order:
            return JsonResponse({"error": "Порядок уроков не указан"}, status=400)

        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            return JsonResponse({"error": "Курс не найден"}, status=404)

        if course.creator != request.user:
            return JsonResponse({"error": "Доступ запрещен"}, status=403)

        with transaction.atomic():
            lessons = list(course.lessons.filter(id__in=order))
            if len(lessons) != len(order):
                return JsonResponse({"error": "Некоторые уроки не найдены или не принадлежат курсу"}, status=400)

            lesson_dict = {str(lesson.id): lesson for lesson in lessons}

            for index, lesson_id in enumerate(order, start=1):
                lesson = lesson_dict.get(str(lesson_id))
                if lesson:
                    lesson.order = index

            Lesson.objects.bulk_update(lessons, ['order'])

        return JsonResponse({"success": True})

    except json.JSONDecodeError:
        return JsonResponse({"error": "Неверный формат JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": f"Произошла ошибка: {str(e)}"}, status=500)


@login_required
@xframe_options_exempt
def lesson_preview(request, lesson_id):
    """Предпросмотр урока в упрощенном виде (для iframe)"""
    context = {
        'lesson_id': lesson_id,
        'current_user_id': request.user.id,
    }
    return render(request, 'courses/lesson_preview.html', context)