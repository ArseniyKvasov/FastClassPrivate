from django.urls import path
from . import views

urlpatterns = [
    path("page-editor/<uuid:lesson_id>/", views.page_editor_view, name="page_editor_view"),

    path('lesson/<uuid:lesson_id>/sections/', views.lesson_sections, name='lesson_sections'),
    path("section/create/", views.create_section, name="create_section"),
    path("section/<uuid:section_id>/edit/", views.edit_section, name="edit_section"),
    path("section/<uuid:section_id>/delete/", views.delete_section, name="delete_section"),

    path("save-task/", views.save_task, name="save_task"),
    path("delete-task/", views.delete_task, name="delete_task"),

    path("get-task/<uuid:task_id>/", views.get_single_task_view, name="get_task"),
    path("get-tasks/<uuid:section_id>/", views.get_section_tasks_view, name="get_tasks_data"),
]