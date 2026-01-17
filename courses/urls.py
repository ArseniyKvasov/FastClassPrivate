from django.urls import path
from . import views

urlpatterns = [
    path("lesson/<int:lesson_id>/sections/", views.lesson_sections, name="lesson_sections"),
    path("lesson/<int:lesson_id>/sections/reorder/", views.reorder_sections, name="sections_reorder"),
    path("section/create/", views.create_section, name="create_section"),
    path("section/<int:section_id>/edit/", views.edit_section, name="edit_section"),
    path("section/<int:section_id>/delete/", views.delete_section, name="delete_section"),

    path("save-task/", views.save_task, name="save_task"),
    path("delete-task/", views.delete_task, name="delete_task"),
    path('tasks/reorder/', views.reorder_tasks, name='reorder_tasks'),

    path("get-task/<int:task_id>/", views.get_single_task_view, name="get_task"),
    path("get-tasks/<int:section_id>/", views.get_section_tasks_view, name="get_tasks_data"),
]