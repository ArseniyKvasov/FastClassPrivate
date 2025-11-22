from django.shortcuts import render
from django.shortcuts import get_object_or_404

from .models import Classroom
from courses.models import Section, Task


def classroom_view(request, classroom_id):
    classroom = get_object_or_404(Classroom, pk=classroom_id)
    lesson = classroom.lesson

    sections = lesson.sections.order_by("order") if lesson else []
    first_section = sections.first() if lesson else None
    section_id = first_section.id if first_section else None

    return render(
        request,
        "classroom/classroom.html",
        context={
            "classroom_id": classroom.id,
            "lesson_id": lesson.id if lesson else None,
            "sections": sections,
            "section_id": section_id,
            "is_admin": True,
            "room_type": "Classroom",
            "current_user_id": request.user.id,
        }
    )

