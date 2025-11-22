from django.urls import path
from . import views
from .utils import answers_utils

urlpatterns = [
    path("<str:classroom_id>/view/", views.classroom_view, name="classroom_view"),

    path("<str:classroom_id>/save-answer/", answers_utils.save_answer, name="save_answer"),
    path("<str:classroom_id>/mark-answer-as-checked/", answers_utils.mark_answer_as_checked, name="mark_answer_as_checked"),
    path("get-section-answers/", answers_utils.get_section_answers, name="get_section_answers"),
    path("get-task-answer/", answers_utils.get_task_answer, name="get_task_answer"),
]