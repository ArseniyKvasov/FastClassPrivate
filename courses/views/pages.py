from django.shortcuts import render
from django.shortcuts import get_object_or_404
from courses.task_serializers import TASK_SERIALIZER_MAP
from courses.models import Lesson


def page_editor_view(request, lesson_id):
    lesson = get_object_or_404(Lesson, pk=lesson_id)

    sections = lesson.sections.order_by("order")
    first_section = sections.first()
    section_id = first_section.id if first_section else None

    return render(
        request,
        "courses/editor_page.html",
        context={
            "lesson_id": lesson.id,
            "sections": sections,
            "section_id": section_id,
            "is_teacher": lesson.course.creator == request.user,
            "viewed_user_id": request.user.id,
        }
    )