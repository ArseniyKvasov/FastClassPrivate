from django.db import transaction

from courses.models import Course, CourseCopy, LessonCopy, SectionCopy, TaskCopy


@transaction.atomic
def create_course_copy_for_user(course: Course, user, keep_user_content: bool = True):
    """
    Создаёт или обновляет CourseCopy для пользователя.

    Параметры:
    - keep_user_content: если True, пользовательские объекты без original_* сохраняются,
      если False — удаляются при синхронизации.

    - Если копии нет — создаётся новая через _populate_course_copy
    - Если копия есть — вызывается sync_course_copy_with_user
    """
    course_copy, created = CourseCopy.objects.get_or_create(
        creator=user,
        original_course=course,
        defaults={
            "version": course.version,
            "is_public": False,
        }
    )

    if created:
        _populate_course_copy(course, course_copy)
    else:
        sync_course_copy_with_user(course_copy, keep_user_content=keep_user_content)
    normalize_order(course_copy)
    return course_copy


def _populate_course_copy(course: Course, course_copy: CourseCopy):
    """
    Создаёт полный набор LessonCopy, SectionCopy и TaskCopy для нового CourseCopy.
    """
    lesson_order = 0
    for lesson in course.lessons.all().order_by("order"):
        lesson_order += 1
        lesson_copy = LessonCopy.objects.create(
            course=course_copy,
            original_lesson=lesson,
            title=lesson.title,
            order=lesson_order,
        )

        section_order = 0
        for section in lesson.sections.all().order_by("order"):
            section_order += 1
            section_copy = SectionCopy.objects.create(
                lesson=lesson_copy,
                original_section=section,
                title=section.title,
                order=section_order,
            )

            task_order = 0
            for task in section.tasks.all().order_by("order"):
                task_order += 1
                TaskCopy.objects.create(
                    section=section_copy,
                    original_task=task,
                    task_type=task.task_type,
                    edited_content={},
                    order=task_order,
                )


@transaction.atomic
def sync_course_copy_with_user(course_copy: CourseCopy, keep_user_content: bool = True):
    """
    Синхронизирует CourseCopy с оригинальным курсом.

    Параметры:
    - keep_user_content: если True, пользовательские объекты без original_* сохраняются,
      если False — удаляются.
    """
    course = course_copy.original_course
    course_copy.version = course.version
    course_copy.save(update_fields=["version"])

    # Уроки
    existing_lessons = {
        l.original_lesson_id: l for l in course_copy.lessons.all() if l.original_lesson_id
    }
    original_lessons = list(course.lessons.all().order_by("order"))
    lesson_order = 0
    for original_lesson in original_lessons:
        lesson_order += 1
        if original_lesson.id in existing_lessons:
            lesson_copy = existing_lessons.pop(original_lesson.id)
            lesson_copy.title = original_lesson.title
            lesson_copy.order = lesson_order
            lesson_copy.save(update_fields=["title", "order"])
        else:
            lesson_copy = LessonCopy.objects.create(
                course=course_copy,
                original_lesson=original_lesson,
                title=original_lesson.title,
                order=lesson_order,
            )

        # Разделы
        existing_sections = {
            s.original_section_id: s
            for s in lesson_copy.sections.all()
            if s.original_section_id
        }
        original_sections = list(original_lesson.sections.all().order_by("order"))
        section_order = 0
        for original_section in original_sections:
            section_order += 1
            if original_section.id in existing_sections:
                section_copy = existing_sections.pop(original_section.id)
                section_copy.title = original_section.title
                section_copy.order = section_order
                section_copy.save(update_fields=["title", "order"])
            else:
                section_copy = SectionCopy.objects.create(
                    lesson=lesson_copy,
                    original_section=original_section,
                    title=original_section.title,
                    order=section_order,
                )

            # Задания
            existing_tasks = {
                t.original_task_id: t
                for t in section_copy.tasks.all()
                if t.original_task_id
            }
            original_tasks = list(original_section.tasks.all().order_by("order"))
            task_order = 0
            for original_task in original_tasks:
                task_order += 1
                if original_task.id in existing_tasks:
                    task_copy = existing_tasks.pop(original_task.id)
                    task_copy.task_type = original_task.task_type
                    task_copy.order = task_order
                    task_copy.save(update_fields=["task_type", "order"])
                else:
                    TaskCopy.objects.create(
                        section=section_copy,
                        original_task=original_task,
                        task_type=original_task.task_type,
                        edited_content={},
                        order=task_order,
                    )

            # Удаляем устаревшие задания только если keep_user_content=False
            if not keep_user_content:
                TaskCopy.objects.filter(
                    id__in=[t.id for t in existing_tasks.values()]
                ).delete()

        # Удаляем устаревшие разделы только если keep_user_content=False
        if not keep_user_content:
            SectionCopy.objects.filter(
                id__in=[s.id for s in existing_sections.values()]
            ).delete()

    # Удаляем устаревшие уроки только если keep_user_content=False
    if not keep_user_content:
        LessonCopy.objects.filter(
            id__in=[l.id for l in existing_lessons.values()]
        ).delete()


def normalize_order(course_copy: CourseCopy):
    """
    Приводит все order уроков, разделов и заданий к непрерывной последовательности
    """
    # Уроки
    lessons = course_copy.lessons.all().order_by("order", "id")
    for idx, lesson in enumerate(lessons, start=1):
        if lesson.order != idx:
            lesson.order = idx
            lesson.save(update_fields=["order"])

        # Разделы
        sections = lesson.sections.all().order_by("order", "id")
        for s_idx, section in enumerate(sections, start=1):
            if section.order != s_idx:
                section.order = s_idx
                section.save(update_fields=["order"])

            # Задания
            tasks = section.tasks.all().order_by("order", "id")
            for t_idx, task in enumerate(tasks, start=1):
                if task.order != t_idx:
                    task.order = t_idx
                    task.save(update_fields=["order"])