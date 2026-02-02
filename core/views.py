from django.shortcuts import render, get_object_or_404, redirect
from django.db.models import Q, Subquery
from django.db import models
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
    """

    base_courses = (
        Course.objects
        .filter(deactivated_at__isnull=True)
        .only(
            'id',
            'title',
            'description',
            'subject',
            'is_public',
            'root_type',
            'creator_id',
            'linked_to_id',
        )
    )

    user_courses = Course.objects.none()
    public_courses = Course.objects.none()
    user_classrooms = []

    if request.user.is_authenticated:
        user_courses = base_courses.filter(
            creator=request.user,
            root_type="original",
        )

        referenced_course_ids = Subquery(
            base_courses.filter(
                creator=request.user,
                linked_to__isnull=False,
            ).values('linked_to_id')
        )

        public_courses = (
            base_courses
            .filter(
                is_public=True,
                root_type="clone",
            )
            .exclude(
                id__in=referenced_course_ids
            )
            .exclude(
                creator=request.user
            )
        )

        classrooms = (
            Classroom.objects
            .filter(
                models.Q(teacher=request.user) |
                models.Q(students=request.user)
            )
            .select_related('lesson')
            .only('id', 'title', 'teacher_id', 'lesson__title')
            .distinct()
        )

        for classroom in classrooms:
            user_classrooms.append({
                'id': classroom.id,
                'title': classroom.title,
                'role': 'Учитель' if classroom.teacher_id == request.user.id else 'Ученик',
                'lesson_title': classroom.lesson.title if classroom.lesson else None,
            })

    else:
        public_courses = base_courses.filter(
            is_public=True,
            root_type="clone",
        )

    math_courses = public_courses.filter(subject='math')
    english_courses = public_courses.filter(subject='english')
    other_courses = public_courses.filter(subject='other')

    SUBJECT_DISPLAY = dict(Course._meta.get_field('subject').choices)

    def serialize_courses(qs):
        return [
            {
                'id': course.id,
                'title': course.title,
                'description': course.description,
                'subject': course.subject,
                'subject_display': SUBJECT_DISPLAY.get(course.subject, course.subject),
                'is_public': course.is_public,
                'root_type': course.root_type,
            }
            for course in qs
        ]

    priority_subject = request.GET.get('subject', '').lower()

    if not priority_subject:
        if not request.user.is_authenticated or (not user_classrooms and not user_courses.exists()):
            priority_subject = 'math'

    context = {
        'user_classrooms': user_classrooms,
        'user_courses': serialize_courses(user_courses),
        'math_courses': serialize_courses(math_courses),
        'english_courses': serialize_courses(english_courses),
        'other_courses': serialize_courses(other_courses),
        'priority_subject': priority_subject,
    }

    return render(request, "core/pages/home.html", context)