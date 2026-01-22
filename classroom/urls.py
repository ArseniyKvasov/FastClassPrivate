from django.urls import path
from . import views

urlpatterns = [
    path("page/<int:classroom_id>/", views.classroom_view, name="classroom_view"),
    path("api/create-classroom/", views.create_classroom_view, name="create_classroom_view"),
    path("api/<int:classroom_id>/attach-lesson/<int:lesson_id>/", views.attach_lesson_view, name="attach_lesson_view"),
    path("api/<int:classroom_id>/set-copying-enabled/", views.set_copying_enabled, name="set_copying_enabled"),
    path("api/<int:classroom_id>/change-classroom-password/", views.change_classroom_password, name="change_classroom_password"),
    path("api/<int:classroom_id>/get-current-lesson-id/", views.get_current_lesson_id, name="get_current_lesson_id"),
    path("api/<int:classroom_id>/delete-student/", views.delete_student, name="delete_student"),
    path("join/<int:classroom_id>/", views.join_classroom_view, name="join_classroom_view"),
    path("join/<int:classroom_id>/verify-password/", views.verify_classroom_password_view),
    path("join/<int:classroom_id>/finalize/", views.join_classroom_finalize_view),

    path("<int:classroom_id>/save-answer/", views.save_answer, name="save_answer"),
    path("<int:classroom_id>/mark-answer-as-checked/", views.mark_answer_as_checked, name="mark_answer_as_checked"),
    path("get-section-answers/", views.get_section_answers, name="get_section_answers"),
    path("get-task-answer/", views.get_task_answer, name="get_task_answer"),
    path("<int:classroom_id>/task/<int:task_id>/user/<int:user_id>/delete-answers/", views.delete_user_task_answers, name="delete_user_task_answers"),
    path("<int:classroom_id>/task/<int:task_id>/delete-all-answers/", views.delete_classroom_task_answers, name="delete_classroom_task_answers"),
    path("<int:classroom_id>/section/<int:section_id>/statistics/", views.get_classroom_section_statistics, name="classroom_section_statistics"),
    path("<int:classroom_id>/task/<int:task_id>/statistics/", views.get_classroom_section_statistics, name="classroom_task_statistics"),

    path("messages/<int:classroom_id>/", views.chat_messages, name="chat_messages"),
    path("messages/<int:classroom_id>/send/", views.chat_send, name="chat_send"),
    path("messages/<int:message_id>/edit/", views.chat_edit, name="chat_edit"),
    path("messages/<int:message_id>/delete/", views.chat_delete, name="chat_delete"),
]