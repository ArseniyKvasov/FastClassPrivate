import json
from django.urls import reverse
from django.shortcuts import render, get_object_or_404
from django.db.models import ProtectedError
from django.http import JsonResponse, Http404
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.db.models import Prefetch, Case, When, Value, IntegerField
from courses.models import Course, Lesson
from classroom.models import Classroom

@login_required
@require_POST
def course_edit_meta_view(request, course_id):
    try:
        course = Course.objects.get(id=course_id)
    except Course.DoesNotExist:
        raise Http404("Курс не найден")

    if course.creator != request.user:
        return JsonResponse(
            {"error": "Недостаточно прав"},
            status=403
        )

    try:
        data = json.loads(request.body)
        title = data.get("title", "").strip()
    except json.JSONDecodeError:
        return JsonResponse(
            {"error": "Неверный формат JSON"},
            status=400
        )

    if not title:
        return JsonResponse(
            {"error": "Название не может быть пустым"},
            status=400
        )

    if len(title) > 30:
        return JsonResponse(
            {"error": "Название класса не должно превышать 30 символов"},
            status=400
        )

    description = data.get("description", "")
    description = description.strip() if description is not None else ""

    subject = data.get("subject")
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
    Открывает копию курса, если она есть у пользователя
    """
    course = get_object_or_404(Course, id=course_id)

    if course.creator != request.user and not course.is_public:
        return JsonResponse({"error": "Доступ запрещен"}, status=403)

    user_copy_courses = Course.objects.filter(
        creator=request.user,
        root_type="copy",
        linked_to=course
    )

    if user_copy_courses.exists():
        user_course = user_copy_courses.first()
        lessons = user_course.lessons.all().order_by("order")
        display_course = user_course
    else:
        lessons = course.lessons.all().order_by("order")
        display_course = course

    classrooms_list = Classroom.objects.filter(
        teacher=request.user
    ).order_by("title")

    context = {
        "lessons": lessons,
        "course": display_course,
        "is_public": course.is_public,
        "classrooms_list": classrooms_list,
        "is_user_copy": user_copy_courses.exists(),
        "original_course_id": course.id if user_copy_courses.exists() else None,
    }

    return render(request, "courses/details.html", context)


@login_required
def get_all_courses_for_selection(request):
    """
    Возвращает все курсы пользователя для выбора урока.

    Порядок:
    1. Оригиналы пользователя
    2. Копии пользователя
    3. Публичные клоны, не привязанные к копиям пользователя

    Реализация делает два SQL-запроса: courses + lessons (prefetch).
    """
    user = request.user

    courses_qs = (
        Course.objects
        .for_selection(user)
        .annotate(
            priority=Case(
                When(root_type='original', creator=user, then=Value(0)),
                When(root_type='copy', creator=user, then=Value(1)),
                When(root_type='clone', then=Value(2)),
                default=Value(3),
                output_field=IntegerField(),
            )
        )
        .order_by('priority', '-created_at')
        .only('id', 'title', 'description', 'root_type', 'created_at')
        .prefetch_related(
            Prefetch(
                'lessons',
                queryset=Lesson.objects.only('id', 'title', 'description')
            )
        )
    )

    courses_data = [
        {
            'id': course.id,
            'title': course.title,
            'description': course.description or '',
            'lessons': [
                {
                    'id': lesson.id,
                    'title': lesson.title,
                    'description': lesson.description or '',
                }
                for lesson in course.lessons.all()
            ]
        }
        for course in courses_qs
    ]

    return JsonResponse({'courses': courses_data})