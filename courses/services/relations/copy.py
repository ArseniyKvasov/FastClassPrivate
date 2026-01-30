"""
Сервис для создания копий курсов и синхронизации копий с клонами.
"""
from django.db import transaction
from django.core.exceptions import ValidationError
from courses.models import Course, Lesson, Section, Task


class CopyService:
    """
    Сервис для работы с копиями курсов.
    Копия создается пользователем на основе клона курса.
    """

    @staticmethod
    def create_copy_for_user(clone_course, user):
        """
        Создание копии курса для пользователя.

        Args:
            clone_course: Клон курса (root_type="clone")
            user: Пользователь, создающий копию

        Returns:
            Course: Созданная копия курса

        Raises:
            ValidationError: Если курс не является клоном
        """
        if clone_course.root_type != "clone":
            raise ValidationError("Можно копировать только курсы-клоны")

        existing_copy = CopyService._get_user_copy(clone_course, user)
        if existing_copy:
            return existing_copy

        with transaction.atomic():
            copy_course = Course.objects.create(
                creator=user,
                linked_to=clone_course,
                root_type="copy",
                title=clone_course.title,
                description=clone_course.description,
                subject=clone_course.subject,
                is_public=False
            )
            CopyService._sync_copy_with_clone(copy_course)
            return copy_course

    @staticmethod
    def sync_copy_with_clone(copy_course):
        """
        Синхронизация копии курса с клоном.

        Args:
            copy_course: Копия курса для синхронизации
        """
        if not copy_course.linked_to or copy_course.root_type != "copy":
            return

        CopyService._sync_copy_with_clone(copy_course)

    @staticmethod
    def _get_user_copy(clone_course, user):
        """
        Получение существующей копии курса пользователя.

        Args:
            clone_course: Клон курса
            user: Пользователь

        Returns:
            Course or None: Существующая копия или None
        """
        return Course.objects.filter(
            creator=user,
            root_type="copy",
            linked_to=clone_course
        ).first()

    @staticmethod
    def _sync_copy_with_clone(copy_course):
        """
        Внутренний метод синхронизации копии с клоном.
        """
        with transaction.atomic():
            clone = copy_course.linked_to
            copy_course.title = clone.title
            copy_course.description = clone.description
            copy_course.subject = clone.subject
            copy_course.save(update_fields=['title', 'description', 'subject'])

            clone_lessons = copy_course.linked_to.lessons.all().order_by('order')
            existing_lesson_map = {
                lesson.linked_to_id: lesson
                for lesson in copy_course.lessons.all()
                if lesson.linked_to_id
            }

            for clone_lesson in clone_lessons:
                if clone_lesson.id in existing_lesson_map:
                    lesson = existing_lesson_map[clone_lesson.id]
                    lesson.title = clone_lesson.title
                    lesson.description = clone_lesson.description
                    lesson.save()
                    CopyService._sync_lesson_with_clone(lesson)
                else:
                    lesson = Lesson.objects.create(
                        course=copy_course,
                        linked_to=clone_lesson,
                        root_type="copy",
                        title=clone_lesson.title,
                        description=clone_lesson.description,
                        order=clone_lesson.order
                    )
                    CopyService._sync_lesson_with_clone(lesson)

            copy_course.lessons.filter(linked_to__isnull=True, root_type="copy").delete()
            CopyService._reorder_lessons(copy_course)

    @staticmethod
    def _sync_lesson_with_clone(copy_lesson):
        """
        Синхронизация урока копии с клоном.
        """
        if not copy_lesson.linked_to:
            return

        with transaction.atomic():
            clone_sections = copy_lesson.linked_to.sections.all().order_by('order')
            existing_section_map = {
                section.linked_to_id: section
                for section in copy_lesson.sections.all()
                if section.linked_to_id
            }

            for clone_section in clone_sections:
                if clone_section.id in existing_section_map:
                    section = existing_section_map[clone_section.id]
                    section.title = clone_section.title
                    section.save()
                    CopyService._sync_section_with_clone(section)
                else:
                    section = Section.objects.create(
                        lesson=copy_lesson,
                        linked_to=clone_section,
                        root_type="copy",
                        title=clone_section.title,
                        order=clone_section.order
                    )
                    CopyService._sync_section_with_clone(section)

            copy_lesson.sections.filter(linked_to__isnull=True, root_type="copy").delete()
            CopyService._reorder_sections(copy_lesson)

    @staticmethod
    def _sync_section_with_clone(copy_section):
        """
        Синхронизация секции копии с клоном.
        """
        if not copy_section.linked_to:
            return

        with transaction.atomic():
            clone_tasks = copy_section.linked_to.tasks.all().order_by('order')
            existing_task_map = {
                task.linked_to_id: task
                for task in copy_section.tasks.all()
                if task.linked_to_id
            }

            for clone_task in clone_tasks:
                if clone_task.id in existing_task_map:
                    task = existing_task_map[clone_task.id]
                    task.task_type = clone_task.task_type
                    task.content_type = clone_task.content_type
                    task.object_id = clone_task.object_id
                    task.save()
                else:
                    Task.objects.create(
                        section=copy_section,
                        linked_to=clone_task,
                        root_type="copy",
                        task_type=clone_task.task_type,
                        content_type=clone_task.content_type,
                        object_id=clone_task.object_id,
                        edited_content=clone_task.edited_content,
                        order=clone_task.order
                    )

            copy_section.tasks.filter(linked_to__isnull=True, root_type="copy").delete()
            CopyService._reorder_tasks(copy_section)

    @staticmethod
    def _reorder_lessons(course):
        """
        Пересчет порядка уроков в курсе.
        """
        lessons = course.lessons.all().order_by('order')
        for index, lesson in enumerate(lessons):
            lesson.order = index + 1
            lesson.save(update_fields=['order'])

    @staticmethod
    def _reorder_sections(lesson):
        """
        Пересчет порядка секций в уроке.
        """
        sections = lesson.sections.all().order_by('order')
        for index, section in enumerate(sections):
            section.order = index + 1
            section.save(update_fields=['order'])

    @staticmethod
    def _reorder_tasks(section):
        """
        Пересчет порядка задач в секции.
        """
        tasks = section.tasks.all().order_by('order')
        for index, task in enumerate(tasks):
            task.order = index + 1
            task.save(update_fields=['order'])