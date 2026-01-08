from django.shortcuts import render, redirect
from django.shortcuts import get_object_or_404
from classroom.models import Classroom
from courses.models import Section, Task


def classroom_view(request, classroom_id):
    classroom = get_object_or_404(Classroom, pk=classroom_id)
    lesson = classroom.lesson

    sections = lesson.sections.order_by("order") if lesson else []
    first_section = sections.first() if sections else None
    section_id = first_section.id if first_section else None

    students_qs = classroom.students.all().values("id", "username")
    students_list = [
        {"id": student["id"], "name": student["username"]}
        for student in students_qs
    ]

    invite_url = request.build_absolute_uri(
        f"/classroom/join/{classroom.invite_code}/"
    )

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
            "sections": sections,
            "section_id": section_id,
            "is_teacher": is_teacher,
            "viewed_user_id": viewed_user_id,
            "students_list": students_list,
            "invite_url": invite_url,
            "current_user_id": request.user.id,
        }
    )


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
