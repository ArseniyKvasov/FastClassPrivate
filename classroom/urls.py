from django.urls import path
from . import views

urlpatterns = [
    path("<str:classroom_id>/view/", views.classroom_view, name="classroom_view"),

    path("<str:classroom_id>/save-answer/", views.save_answer, name="save_answer"),
    path("<str:classroom_id>/mark-answer-as-checked/", views.mark_answer_as_checked, name="mark_answer_as_checked"),
    path("get-task-answer/", views.get_task_answer, name="get_task_answer"),
]