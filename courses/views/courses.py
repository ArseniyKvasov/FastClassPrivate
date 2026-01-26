from django.urls import reverse
from django.shortcuts import render, get_object_or_404
from django.db.models import ProtectedError
from django.http import JsonResponse, Http404
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from courses.models import Course, Lesson


@login_required
@require_POST
def course_edit_meta_view(request, course_id):
    """
    Обновляет метаданные курса (title, description, subject).

    Доступ разрешён только создателю курса.
    Ожидает POST-параметры:
        - title (обязательный)
        - description (необязательный)
        - subject (необязательный)
    Возвращает JSON с обновлёнными данными.
    """
    try:
        course = Course.objects.get(id=course_id)
    except Course.DoesNotExist:
        raise Http404("Курс не найден")

    if course.creator != request.user:
        return JsonResponse(
            {"error": "Недостаточно прав"},
            status=403
        )

    title = request.POST.get("title", "").strip()
    if not title:
        return JsonResponse(
            {"error": "Название не может быть пустым"},
            status=400
        )

    description = request.POST.get("description", "")
    description = description.strip() if description is not None else ""

    subject = request.POST.get("subject")
    if subject is not None:
        subject = subject.strip()
        if subject not in {"math", "english", "other"}:
            return JsonResponse(
                {"error": "Некорректный предмет"},
                status=400
            )
        course.subject = subject

    course.title = title
    course.description = description
    course.save(update_fields=["title", "description", "subject"])

    SUBJECT_DISPLAY = dict(Course._meta.get_field('subject').choices)

    return JsonResponse({
        "success": True,
        "updated": {
            "title": course.title,
            "description": course.description,
            "subject": course.subject,
            "subject_display": SUBJECT_DISPLAY.get(course.subject, course.subject)
        }
    })


@login_required
@require_POST
def create_course(request):
    title = request.POST.get("title")
    description = request.POST.get("description", "")
    subject = request.POST.get("subject", "other")

    if not title:
        return JsonResponse({"error": "title обязательное поле"}, status=400)

    course = Course.objects.create(
        creator=request.user,
        title=title,
        description=description,
        subject=subject,
        is_public=False,
    )

    course_url = reverse("course_detail", args=[course.id])

    return JsonResponse({
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "subject": course.subject,
        "version": course.version,
        "url": course_url
    })


@login_required
@require_POST
def delete_course(request, course_id):
    """
    Удаляет курс. Доступ разрешён только создателю курса.
    Если курс используется другими пользователями (ProtectedError),
    возвращает ошибку JSON.
    """
    try:
        course = Course.objects.get(id=course_id)
    except Course.DoesNotExist:
        raise Http404("Курс не найден")

    if course.creator != request.user:
        return JsonResponse({"error": "Недостаточно прав"}, status=403)

    try:
        course.delete()
    except ProtectedError:
        return JsonResponse({
            "error": "Нельзя удалить курс, так как его используют другие пользователи"
        }, status=400)

    return JsonResponse({"success": True})


@login_required
@require_POST
def create_lesson(request, course_id):
    """
    Создаёт урок внутри курса.
    POST параметры:
        - title: название урока
        - description: описание урока (необязательно)
        - order: порядок урока (необязательно, default=0)
    """
    course = get_object_or_404(Course, id=course_id)

    if course.creator != request.user:
        return JsonResponse({"error": "Доступ запрещен"}, status=403)

    title = request.POST.get("title")
    description = request.POST.get("description", "")
    order = request.POST.get("order", 0)

    if not title:
        return JsonResponse({"error": "title обязательное поле"}, status=400)

    lesson = Lesson.objects.create(
        course=course,
        title=title,
        description=description,
        order=int(order),
    )

    return JsonResponse({
        "id": lesson.id,
        "title": lesson.title,
        "description": lesson.description,
        "order": lesson.order,
        "course_id": course.id,
    })


@login_required
def course_detail(request, course_id):
    """
    Детальная страница курса.

    Для пользовательских курсов (копий) проверяет наличие новой версии оригинального курса.
    Если есть новая версия - передает ее ID для отображения кнопки "Обновить курс".
    Для публичных курсов проверка версий не выполняется.
    """

    course = get_object_or_404(Course, id=course_id)

    if course.creator != request.user and course.is_public == False:
        return JsonResponse({"error": "Доступ запрещен"}, status=403)

    lessons = course.lessons.all().order_by("order")

    latest_version_id = None

    if course.original_course:
        latest_version = course.original_course.get_latest_version()
        if latest_version and latest_version.id != course.original_course.id:
            latest_version_id = latest_version.id

    context = {
        "lessons": lessons,
        "course": course,
        "is_public": course.is_public,
        "latest_version_id": latest_version_id,
    }

    return render(request, "courses/details.html", context)
