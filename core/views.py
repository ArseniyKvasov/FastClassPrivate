from django.shortcuts import render, get_object_or_404
from django.db.models import Q
from courses.models import Course
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from django.views.decorators.http import require_GET
from django.contrib.auth.decorators import login_required
from core.services import get_display_name_from_username
from classroom.models import Classroom

User = get_user_model()


def home(request):
    if request.user.is_authenticated:
        courses = Course.objects.filter(Q(is_public=True) | Q(creator=request.user)).distinct()
    else:
        courses = Course.objects.filter(is_public=True)
    return render(request, "core/pages/home.html", {"courses": courses})


def course_detail(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    lessons = course.lessons.all()
    classrooms_list = Classroom.objects.filter(teacher=request.user)
    return render(request, "core/pages/courses/detail.html", {
        "course": course,
        "lessons": lessons,
        "classrooms_list": classrooms_list
    })


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
