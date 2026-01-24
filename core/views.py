from django.shortcuts import render, get_object_or_404
from django.db.models import Q
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from django.views.decorators.http import require_GET, require_POST
from django.contrib.auth.decorators import login_required
from core.services import get_display_name_from_username
from courses.models import Course, Lesson
from classroom.models import Classroom

User = get_user_model()


def home(request):
    courses = Course.objects.filter(deactivated_at__isnull=True, original_course__isnull=True)

    if request.user.is_authenticated:
        courses = courses.filter(Q(creator=request.user) | Q(is_public=True)).distinct()
    else:
        courses = courses.filter(is_public=True)

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

    user_courses = courses.filter(creator=request.user) if request.user.is_authenticated else Course.objects.none()

    math_courses = courses.filter(subject='math')
    english_courses = courses.filter(subject='english')
    other_courses = courses.filter(subject='other')

    SUBJECT_DISPLAY = dict(Course._meta.get_field('subject').choices)

    def serialize_courses(qs):
        serialized = []
        for c in qs:
            serialized.append({
                'id': c.id,
                'title': c.title,
                'description': c.description,
                'subject': c.subject,
                'subject_display': SUBJECT_DISPLAY.get(c.subject, c.subject),
                'is_public': c.is_public
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
