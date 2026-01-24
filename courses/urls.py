from django.urls import path
from . import views

urlpatterns = [
    path("edit-meta/<int:course_id>/", views.course_edit_meta_view, name="course_edit_meta_view"),

    path("api/create/", views.create_course, name="create_course"),
    path("api/<int:course_id>/delete/", views.delete_course, name="delete_course"),
    path("api/course/<int:course_id>/lesson/create/", views.create_lesson, name="create_lesson"),
    path("course/<int:course_id>/", views.course_detail, name="course_detail"),

    path("course/<int:course_id>/lesson/create/", views.create_lesson, name="create_lesson"),
    path("course/<int:course_id>/lessons/reorder/", views.reorder_lessons, name="reorder_lessons"),
    path("lesson/<int:lesson_id>/edit/", views.edit_lesson, name="edit_lesson"),
    path("lesson/<int:lesson_id>/delete/", views.delete_lesson, name="delete_lesson"),
    path("lesson/<int:lesson_id>/preview/", views.lesson_preview, name="lesson_preview"),

    path("lesson/<int:lesson_id>/sections/", views.lesson_sections, name="lesson_sections"),
    path("lesson/<int:lesson_id>/sections/reorder/", views.reorder_sections, name="sections_reorder"),
    path("section/create/", views.create_section, name="create_section"),
    path("section/<int:section_id>/edit/", views.edit_section, name="edit_section"),
    path("section/<int:section_id>/delete/", views.delete_section, name="delete_section"),

    path("save-task/", views.save_task, name="save_task"),
    path("delete-task/", views.delete_task, name="delete_task"),
    path("tasks/reorder/", views.reorder_tasks, name="reorder_tasks"),

    path("get-task/<int:task_id>/", views.get_single_task_view, name="get_task"),
    path("get-tasks/<int:section_id>/", views.get_section_tasks_view, name="get_tasks_data"),
]