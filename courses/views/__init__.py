from .courses import course_edit_meta_view, create_course, delete_course, create_lesson, course_detail, get_all_courses_for_selection
from .lessons import create_lesson, edit_lesson, delete_lesson, reorder_lessons, lesson_preview
from .sections import lesson_sections, create_section, reorder_sections, edit_section, delete_section
from .tasks.handlers import save_task, delete_task, reorder_tasks
from .tasks.view import get_single_task_view, get_section_tasks_view