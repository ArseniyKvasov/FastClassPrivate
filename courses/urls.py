from django.urls import path
from . import views

urlpatterns = [
    path("page-editor/<uuid:lesson_id>/", views.page_editor_view, name="page_editor_view"),
    path("save-task/", views.save_task, name="save_task"),
    path("delete-task/", views.delete_task, name="delete_task"),
    path("get-tasks/<uuid:section_id>/", views.get_tasks_view, name="get_tasks_data"),
]