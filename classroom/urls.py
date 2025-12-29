from django.urls import path
from . import views

urlpatterns = [
    path("<str:classroom_id>/view/", views.classroom_view, name="classroom_view"),
    path("join/<str:invite_code>/", views.join_classroom, name="join_classroom"),

    path("<str:classroom_id>/save-answer/", views.save_answer, name="save_answer"),
    path("<str:classroom_id>/mark-answer-as-checked/", views.mark_answer_as_checked, name="mark_answer_as_checked"),
    path("get-section-answers/", views.get_section_answers, name="get_section_answers"),
    path("get-task-answer/", views.get_task_answer, name="get_task_answer"),
    path("<str:classroom_id>/task/<uuid:task_id>/user/<uuid:user_id>/delete-answers/", views.delete_user_task_answers, name="delete_user_task_answers"),
    path("<str:classroom_id>/task/<uuid:task_id>/delete-all-answers/", views.delete_classroom_task_answers, name="delete_classroom_task_answers"),
    path('<str:classroom_id>/section/<uuid:section_id>/statistics/', views.get_classroom_section_statistics, name='classroom_section_statistics'),
    path('<str:classroom_id>/task/<uuid:task_id>/statistics/', views.get_classroom_section_statistics, name='classroom_task_statistics'),
]