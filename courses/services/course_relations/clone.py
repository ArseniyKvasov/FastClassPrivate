"""
Сервис для клонирования курсов и синхронизации клонов с оригиналами.
"""
import os
import shutil
from django.conf import settings
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from courses.models import Course, Lesson, Section, Task


class CloneService:
    """
    Сервис для работы с клонами курсов.
    Клон создается администратором на основе оригинального курса.
    """

    @staticmethod
    def create_clone(original_course, user):
        """
        Создание клона курса администратором.

        Args:
            original_course: Оригинальный курс (root_type="original")
            user: Пользователь, создающий клон

        Returns:
            Course: Созданный клон курса

        Raises:
            ValidationError: Если курс не является оригиналом
        """
        if original_course.root_type != "original":
            raise ValidationError("Клон можно создать только из оригинального курса")

        with transaction.atomic():
            clone_course = Course.objects.create(
                creator=user,
                linked_to=original_course,
                root_type="clone",
                title=f"{original_course.title} (Клон)",
                description=original_course.description,
                subject=original_course.subject,
                is_public=False,
            )
            CloneService._sync_clone_with_original(clone_course)
            return clone_course

    @staticmethod
    def sync_clone_with_original(clone_course):
        """
        Синхронизация клона курса с оригиналом.

        Args:
            clone_course: Клон курса для синхронизации
        """
        if not clone_course.linked_to or clone_course.root_type != "clone":
            return

        CloneService._sync_clone_with_original(clone_course)

    @staticmethod
    def _sync_clone_with_original(clone_course):
        """
        Внутренний метод синхронизации клона с оригиналом.
        """
        with transaction.atomic():
            original = clone_course.linked_to
            clone_course.title = original.title
            clone_course.description = original.description
            clone_course.subject = original.subject
            clone_course.save(update_fields=['title', 'description', 'subject'])

            original_lessons = clone_course.linked_to.lessons.all().order_by('order')
            existing_lesson_map = {
                lesson.linked_to_id: lesson
                for lesson in clone_course.lessons.all()
                if lesson.linked_to_id
            }

            for original_lesson in original_lessons:
                if original_lesson.id in existing_lesson_map:
                    lesson = existing_lesson_map[original_lesson.id]
                    lesson.title = original_lesson.title
                    lesson.description = original_lesson.description
                    lesson.save()
                    CloneService._sync_lesson_with_original(lesson)
                else:
                    lesson = Lesson.objects.create(
                        course=clone_course,
                        linked_to=original_lesson,
                        root_type="clone",
                        title=original_lesson.title,
                        description=original_lesson.description,
                        order=original_lesson.order
                    )
                    CloneService._sync_lesson_with_original(lesson)

            clone_course.lessons.filter(linked_to__isnull=True).delete()
            CloneService._reorder_lessons(clone_course)

            for copy in Course.objects.filter(linked_to=clone_course):
                from .copy import CopyService
                CopyService.sync_copy_with_clone(copy)

    @staticmethod
    def _sync_lesson_with_original(clone_lesson):
        """
        Синхронизация урока клона с оригиналом.
        """
        if not clone_lesson.linked_to:
            return

        with transaction.atomic():
            original_sections = clone_lesson.linked_to.sections.all().order_by('order')
            existing_section_map = {
                section.linked_to_id: section
                for section in clone_lesson.sections.all()
                if section.linked_to_id
            }

            for original_section in original_sections:
                if original_section.id in existing_section_map:
                    section = existing_section_map[original_section.id]
                    section.title = original_section.title
                    section.save()
                    CloneService._sync_section_with_original(section)
                else:
                    section = Section.objects.create(
                        lesson=clone_lesson,
                        linked_to=original_section,
                        root_type="clone",
                        title=original_section.title,
                        order=original_section.order
                    )
                    CloneService._sync_section_with_original(section)

            clone_lesson.sections.filter(linked_to__isnull=True).delete()
            CloneService._reorder_sections(clone_lesson)

    @staticmethod
    def _sync_section_with_original(clone_section):
        """
        Синхронизация секции клона с оригиналом.
        """
        if not clone_section.linked_to:
            return

        with transaction.atomic():
            original_tasks = clone_section.linked_to.tasks.all().order_by('order')
            existing_task_map = {
                task.linked_to_id: task
                for task in clone_section.tasks.all()
                if task.linked_to_id
            }

            for original_task in original_tasks:
                if original_task.id in existing_task_map:
                    task = existing_task_map[original_task.id]
                    task.task_type = original_task.task_type

                    new_specific = CloneService._clone_specific_object(original_task)

                    old_specific = task.get_specific()

                    task.content_type = ContentType.objects.get_for_model(new_specific)
                    task.object_id = new_specific.pk
                    task.edited_content = {}
                    task.save()

                    if old_specific:
                        try:
                            old_specific.delete()
                        except Exception as e:
                            raise ValidationError(
                                f"Не удалось удалить старый specific объект: {str(e)}"
                            )
                else:
                    new_specific = CloneService._clone_specific_object(original_task)

                    Task.objects.create(
                        section=clone_section,
                        linked_to=original_task,
                        root_type="clone",
                        task_type=original_task.task_type,
                        content_type=ContentType.objects.get_for_model(new_specific),
                        object_id=new_specific.pk,
                        edited_content={},
                        order=original_task.order
                    )

            clone_section.tasks.filter(linked_to__isnull=True).delete()
            CloneService._reorder_tasks(clone_section)

    @staticmethod
    def _clone_specific_object(original_task):
        """
        Клонирование специфического объекта задачи с обработкой файлов.

        Args:
            original_task: Оригинальная задача

        Returns:
            object: Клонированный specific объект
        """
        original_specific = original_task.get_specific()
        if not original_specific:
            raise ValidationError(f"У задачи {original_task.id} нет specific объекта")

        model_class = original_specific.__class__
        fields = [f.name for f in model_class._meta.get_fields()
                 if f.name not in ['id', 'pk', 'created_at', 'updated_at'] and not f.is_relation]

        specific_data = {}
        for field in fields:
            specific_data[field] = getattr(original_specific, field)

        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        for field_name, field_value in list(specific_data.items()):
            if isinstance(field_value, str) and field_value.startswith(settings.MEDIA_URL):
                original_path = field_value.replace(settings.MEDIA_URL, "", 1)
                original_full_path = os.path.join(settings.MEDIA_ROOT, original_path)

                if os.path.exists(original_full_path):
                    filename, extension = os.path.splitext(os.path.basename(original_path))
                    new_filename = f"{filename}_clone_{timestamp}{extension}"
                    new_relative_path = os.path.join(os.path.dirname(original_path), new_filename)
                    new_full_path = os.path.join(settings.MEDIA_ROOT, new_relative_path)

                    os.makedirs(os.path.dirname(new_full_path), exist_ok=True)
                    shutil.copy2(original_full_path, new_full_path)

                    specific_data[field_name] = settings.MEDIA_URL + new_relative_path

        new_specific = model_class.objects.create(**specific_data)
        return new_specific

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