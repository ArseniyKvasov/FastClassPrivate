from django.shortcuts import render, get_object_or_404
from django.db.models import Q
from courses.models import Course

def home(request):
    if request.user.is_authenticated:
        courses = Course.objects.filter(Q(is_public=True) | Q(creator=request.user)).distinct()
    else:
        courses = Course.objects.filter(is_public=True)
    return render(request, "core/pages/home.html", {"courses": courses})

def course_detail(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    lessons = course.lessons.all()  # все уроки курса
    return render(request, "core/pages/courses/detail.html", {"course": course, "lessons": lessons})
