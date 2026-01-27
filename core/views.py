from django.shortcuts import render, get_object_or_404, redirect
from django.db.models import Q
from django.http import JsonResponse
from django.contrib.auth import authenticate, login
from django.contrib.auth import get_user_model
from django.views.decorators.http import require_GET, require_POST
from django.contrib.auth.decorators import login_required
from core.services import get_display_name_from_username
from courses.models import Course, Lesson
from classroom.models import Classroom

User = get_user_model()


def home(request):
    """
    Главная страница с курсами и классами пользователя.

    Возвращает:
    - Раздел "Мои курсы": только курсы, созданные текущим пользователем
    - Разделы по предметам (Математика/Английский/Другое): только публичные курсы,
      исключая те, на которые ссылаются пользовательские курсы через original_course,
      а также исключая курсы, созданные самим пользователем
    - Список классов пользователя: где он является учителем или учеником
    """
    courses = Course.objects.filter(deactivated_at__isnull=True)

    user_courses = Course.objects.none()
    public_courses = Course.objects.none()

    if request.user.is_authenticated:
        user_courses = courses.filter(creator=request.user)

        referenced_course_ids = user_courses.values_list('original_course_id', flat=True)
        referenced_course_ids = [id for id in referenced_course_ids if id is not None]

        public_courses = courses.filter(
            is_public=True
        ).exclude(
            id__in=referenced_course_ids
        ).exclude(
            creator=request.user
        )
    else:
        public_courses = courses.filter(is_public=True)

    math_courses = public_courses.filter(subject='math')
    english_courses = public_courses.filter(subject='english')
    other_courses = public_courses.filter(subject='other')

    user_classrooms = []
    if request.user.is_authenticated:
        teacher_classrooms = Classroom.objects.filter(teacher=request.user)
        student_classrooms = Classroom.objects.filter(students=request.user)

        for classroom in teacher_classrooms:
            user_classrooms.append({
                'id': classroom.id,
                'title': classroom.title,
                'role': 'Учитель',
                'lesson_title': classroom.lesson.title if classroom.lesson else None,
            })

        for classroom in student_classrooms:
            user_classrooms.append({
                'id': classroom.id,
                'title': classroom.title,
                'role': 'Ученик',
                'lesson_title': classroom.lesson.title if classroom.lesson else None,
            })

    SUBJECT_DISPLAY = dict(Course._meta.get_field('subject').choices)

    def serialize_courses(qs):
        """Сериализация queryset курсов для шаблона."""
        serialized = []
        for course in qs:
            serialized.append({
                'id': course.id,
                'title': course.title,
                'description': course.description,
                'subject': course.subject,
                'subject_display': SUBJECT_DISPLAY.get(course.subject, course.subject),
                'is_public': course.is_public
            })
        return serialized

    context = {
        'user_classrooms': user_classrooms,
        'user_courses': serialize_courses(user_courses),
        'math_courses': serialize_courses(math_courses),
        'english_courses': serialize_courses(english_courses),
        'other_courses': serialize_courses(other_courses),
    }

    return render(request, "core/pages/home.html", context)


@require_GET
@login_required
def get_username_by_id(request, user_id):
    """
    Получает имя пользователя по ID.
    Возвращает JSON с username или ошибку.
    """
    try:
        user = User.objects.get(id=user_id)

        return JsonResponse({
            'id': user.id,
            'username': get_display_name_from_username(user.username),
            'email': user.email
        })

    except User.DoesNotExist:
        return JsonResponse(
            {'error': 'Пользователь не найден'},
            status=404
        )
    except Exception as e:
        return JsonResponse(
            {'error': f'Внутренняя ошибка сервера: {str(e)}'},
            status=500)
