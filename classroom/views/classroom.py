from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404
from classroom.models import Classroom
from courses.models import Section, Task
from django.http import JsonResponse


def classroom_view(request, classroom_id):
    classroom = get_object_or_404(Classroom, pk=classroom_id)
    lesson = classroom.lesson

    students_qs = classroom.students.all().values("id", "username")
    students_list = [
        {"id": student["id"], "name": student["username"]}
        for student in students_qs
    ]

    is_teacher = request.user == classroom.teacher

    if not students_list:
        students_list = [{"id": request.user.id, "name": request.user.username}]
    viewed_user_id = students_list[0]["id"]

    return render(
        request,
        "classroom/classroom_page.html",
        context={
            "classroom_id": classroom.id,
            "lesson_id": lesson.id if lesson else None,
            "is_teacher": is_teacher,
            "viewed_user_id": viewed_user_id,
            "students_list": students_list,
            "current_user_id": request.user.id,
        }
    )



@login_required
def get_current_lesson_id(request, classroom_id):
    """
    Возвращает ID текущего урока для указанного класса.
    Критерий "текущий" можно определить:
      - первый урок класса,
      - последний созданный,
      - или логика по дате/статусу.
    """

    classroom = get_object_or_404(Classroom, pk=classroom_id)

    lesson = classroom.lesson

    if not lesson:
        return JsonResponse({"lesson_id": None})

    return JsonResponse({"lesson_id": lesson.id})

def join_classroom(request, invite_code):
    if not request.user.is_authenticated:
        return redirect(f'/auth/login/?next=/classroom/join/{invite_code}/')

    try:
        classroom = Classroom.objects.get(invite_code=invite_code)

        if request.user == classroom.teacher or classroom.students.filter(id=request.user.id).exists():
            return redirect('classroom_view', classroom_id=classroom.id)

        classroom.students.add(request.user)
        return redirect('classroom_view', classroom_id=classroom.id)

    except Classroom.DoesNotExist:
        return redirect('home')
