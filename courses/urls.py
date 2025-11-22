from django.urls import path
from . import views
from .utils import tasks_utils

urlpatterns = [
    path("page-editor/<uuid:lesson_id>/", views.page_editor_view, name="page_editor_view"),
    path("save-task/", tasks_utils.save_task, name="save_task"),
    path("delete-task/", tasks_utils.delete_task, name="delete_task"),
    path("get-tasks/<uuid:section_id>/", tasks_utils.get_section_tasks_view, name="get_tasks_data"),
    path("get-task/<uuid:task_id>/", tasks_utils.get_single_task_view, name="get_task"),

    path("section/create/", views.create_section_view, name="create_section"),
    path("section/delete/", views.delete_section_view, name="delete_section"),
    path("section/edit/", views.edit_section_view, name="edit_section"),
]