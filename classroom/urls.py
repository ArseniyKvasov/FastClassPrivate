from django.urls import path
from . import views

urlpatterns = [
    path("page/<str:classroom_id>/", views.classroom_view, name="classroom_view"),
    path("join/<str:invite_code>/", views.join_classroom, name="join_classroom"),

    path("<str:classroom_id>/save-answer/", views.save_answer, name="save_answer"),
    path("<str:classroom_id>/mark-answer-as-checked/", views.mark_answer_as_checked, name="mark_answer_as_checked"),
    path("get-section-answers/", views.get_section_answers, name="get_section_answers"),
    path("get-task-answer/", views.get_task_answer, name="get_task_answer"),
    path("<str:classroom_id>/task/<uuid:task_id>/user/<int:user_id>/delete-answers/", views.delete_user_task_answers, name="delete_user_task_answers"),
    path("<str:classroom_id>/task/<uuid:task_id>/delete-all-answers/", views.delete_classroom_task_answers, name="delete_classroom_task_answers"),
    path("<str:classroom_id>/section/<uuid:section_id>/statistics/", views.get_classroom_section_statistics, name="classroom_section_statistics"),
    path("<str:classroom_id>/task/<uuid:task_id>/statistics/", views.get_classroom_section_statistics, name="classroom_task_statistics"),

    path("messages/<str:classroom_id>/", views.chat_messages, name="chat_messages"),
    path("messages/<str:classroom_id>/send/", views.chat_send, name="chat_send"),
    path("messages/<int:message_id>/edit/", views.chat_edit, name="chat_edit"),
    path("messages/<int:message_id>/delete/", views.chat_delete, name="chat_delete"),
]