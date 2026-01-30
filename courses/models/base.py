"""
Модели для системы курсов с поддержкой оригиналов, клонов и копий.
Алгоритм flow создания и распространения курсов:
1. Создание: Пользователь создает оригинальный курс (root_type="original")
2. Публикация: Администратор создает клон (root_type="clone") на основе оригинального курса
3. Копирование: Пользователь создает копию (root_type="copy") на основе клона
4. Обновление оригинала -> Синхронизация клона -> Синхронизация копий

Каждый пользователь может иметь только одну копию каждого курса-клона.
"""

import os
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import models, transaction
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.contrib.contenttypes.models import ContentType
from django.db.models import Subquery, Q
from django.contrib.contenttypes.fields import GenericForeignKey

User = get_user_model()

SUBJECT_CHOICES = [
    ("math", "Математика"),
    ("english", "Английский"),
    ("other", "Другое"),
]

TYPE_CHOICES = [
    ("test", "Тест"),
    ("note", "Заметка"),
    ("image", "Изображение"),
    ("true_false", "Правда или ложь"),
    ("fill_gaps", "Заполнить пропуски"),
    ("match_cards", "Соотнести карточки"),
    ("text_input", "Ввод текста"),
    ("file", "Файл"),
    ("word_list", "Список слов"),
]

ROOT_TYPE_CHOICES = [
    ("original", "Оригинал"),
    ("clone", "Клон"),
    ("copy", "Копия"),
]


class CourseQuerySet(models.QuerySet):
    def active(self):
        return self.filter(deactivated_at__isnull=True)

    def for_selection(self, user):
        """
        Возвращает queryset курсов для выбора урока:
        - оригиналы пользователя
        - копии пользователя
        - публичные клоны, не связанные с копиями пользователя
        """
        linked_clone_ids = self.model.objects.filter(
            creator=user,
            root_type="copy",
            linked_to__isnull=False,
        ).values("linked_to_id")

        return (
            self.active()
            .filter(
                Q(root_type="original", creator=user)
                | Q(root_type="copy", creator=user)
                | Q(root_type="clone", is_public=True)
            )
            .exclude(Q(root_type="clone", id__in=Subquery(linked_clone_ids)))
        )


class Course(models.Model):
    """Модель курса с поддержкой оригиналов, клонов и копий."""

    id = models.BigAutoField(primary_key=True)
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name="courses")
    linked_to = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="linked_copies",
        help_text="Оригинальный курс, если это копия или клон"
    )
    root_type = models.CharField(
        max_length=20,
        choices=ROOT_TYPE_CHOICES,
        default="original",
        help_text="Тип курса: оригинал, клон или копия"
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    subject = models.CharField(max_length=20, choices=SUBJECT_CHOICES, default="other")
    is_public = models.BooleanField(default=False)
    deactivated_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CourseQuerySet.as_manager()

    def __str__(self):
        return self.title

    @property
    def is_active(self):
        """Проверка, активен ли курс."""
        return self.deactivated_at is None

    def deactivate(self):
        """Деактивация курса."""
        if self.is_active:
            self.deactivated_at = timezone.now()
            self.save(update_fields=['deactivated_at'])

    def activate(self):
        """Активация курса."""
        if not self.is_active:
            self.deactivated_at = None
            self.save(update_fields=['deactivated_at'])

    def get_user_copy(self, user):
        """
        Получение копии курса пользователя.

        Args:
            user: Пользователь для поиска копии

        Returns:
            Course or None: Копия курса пользователя или None
        """
        if self.root_type == "clone":
            return Course.objects.filter(
                creator=user,
                root_type="copy",
                linked_to=self
            ).first()
        elif self.root_type == "original":
            clone = Course.objects.filter(
                linked_to=self,
                root_type="clone"
            ).first()
            if clone:
                return clone.get_user_copy(user)
        return None

    def create_copy_for_user(self, user):
        from courses.services import CopyService
        return CopyService.create_copy_for_user(self, user)

    def create_clone(self, user):
        from courses.services import CloneService
        return CloneService.create_clone(self, user)

    def synchronize_with_original(self):
        from courses.services import CloneService
        return CloneService.sync_clone_with_original(self)

    def synchronize_with_clone(self):
        from courses.services import CopyService
        return CopyService.sync_copy_with_clone(self)

    def delete(self, using=None, keep_parents=False):
        """
        Удаление курса с учетом связанных копий.
        """
        if self.linked_to:
            with transaction.atomic():
                for lesson in self.lessons.all():
                    lesson.delete()
                super().delete(using=using, keep_parents=keep_parents)
            return

        if Course.objects.filter(linked_to=self).exists():
            raise ValidationError("Нельзя удалить оригинальный курс, пока есть связанные копии")
        with transaction.atomic():
            for linked_copy in Course.objects.filter(linked_to=self):
                for lesson in linked_copy.lessons.all():
                    lesson.delete()
                linked_copy.delete()
            for lesson in self.lessons.all():
                lesson.delete()
            super().delete(using=using, keep_parents=keep_parents)

    class Meta:
        app_label = "courses"
        indexes = [
            models.Index(fields=['deactivated_at']),
            models.Index(fields=['linked_to']),
            models.Index(fields=['creator', 'root_type']),
            models.Index(fields=['root_type', 'is_public']),
        ]
        ordering = ['-created_at']


class Lesson(models.Model):
    """Модель урока курса."""

    id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="lessons")
    linked_to = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="linked_copies",
    )
    root_type = models.CharField(max_length=20, choices=ROOT_TYPE_CHOICES, default="original")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        app_label = "courses"
        ordering = ["order"]

    def __str__(self):
        return f"{self.title} ({self.course.title})"

    def save(self, *args, **kwargs):
        """Сохранение урока с автоматическим определением порядка."""
        if not self.order or self.order == 0:
            max_order = Lesson.objects.filter(course=self.course).aggregate(models.Max('order'))['order__max'] or 0
            self.order = max_order + 1
        super().save(*args, **kwargs)

    def synchronize_with_original(self):
        """Синхронизация клона урока с оригиналом."""
        from courses.services import CloneService
        CloneService._sync_lesson_with_original(self)

    def synchronize_with_clone(self):
        """Синхронизация копии урока с клоном."""
        from courses.services import CopyService
        CopyService._sync_lesson_with_clone(self)

    def delete(self, using=None, keep_parents=False):
        """Удаление урока с удалением связанных секций."""
        with transaction.atomic():
            for section in self.sections.all():
                section.delete()
            super().delete(using=using, keep_parents=keep_parents)


class Section(models.Model):
    """Модель секции урока."""

    id = models.BigAutoField(primary_key=True)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="sections")
    linked_to = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="linked_copies",
    )
    root_type = models.CharField(max_length=20, choices=ROOT_TYPE_CHOICES, default="original")
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        app_label = "courses"
        ordering = ["order"]

    def __str__(self):
        return f"{self.title} ({self.lesson.title})"

    def save(self, *args, **kwargs):
        """Сохранение секции с автоматическим определением порядка."""
        if not self.order or self.order == 0:
            max_order = Section.objects.filter(lesson=self.lesson).aggregate(models.Max('order'))['order__max'] or 0
            self.order = max_order + 1
        super().save(*args, **kwargs)

    def synchronize_with_original(self):
        """Синхронизация клона секции с оригиналом."""
        from courses.services import CloneService
        CloneService._sync_section_with_original(self)

    def synchronize_with_clone(self):
        """Синхронизация копии секции с клоном."""
        from courses.services import CopyService
        CopyService._sync_section_with_clone(self)

    def delete(self, using=None, keep_parents=False):
        """Удаление секции с удалением связанных задач."""
        with transaction.atomic():
            for task in self.tasks.all():
                task.delete()
            super().delete(using=using, keep_parents=keep_parents)


class Task(models.Model):
    """Модель задачи в секции с поддержкой различных типов контента."""

    id = models.BigAutoField(primary_key=True)
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="tasks")
    linked_to = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="linked_copies"
    )
    root_type = models.CharField(max_length=20, choices=ROOT_TYPE_CHOICES, default="original")
    task_type = models.CharField(max_length=50, choices=TYPE_CHOICES, db_index=True)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField(db_index=True)
    specific = GenericForeignKey("content_type", "object_id")
    edited_content = models.JSONField(default=dict, blank=True)
    order = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "courses"
        ordering = ["order"]

    def __str__(self):
        specific_title = getattr(self.specific, "title", None)
        return f"{self.get_task_type_display()}: {specific_title or 'Без названия'}"

    def get_specific(self):
        """
        Получение связанного специфического объекта.

        Returns:
            object or None: Связанный объект или None
        """
        try:
            return self.specific
        except Exception:
            return None

    def save(self, *args, **kwargs):
        """Сохранение задачи с автоматическим определением порядка."""
        if not self.order or self.order == 0:
            max_order = Task.objects.filter(section=self.section).aggregate(models.Max('order'))['order__max'] or 0
            self.order = max_order + 1
        super().save(*args, **kwargs)

    def delete(self, using=None, keep_parents=False):
        """Удаление задачи с учетом типа контента."""
        if self.root_type in ["original", "clone"]:
            spec = self.get_specific()
            if spec is not None:
                try:
                    spec.delete()
                except Exception:
                    pass
        else:
            file_path = self.edited_content.get("file_path")
            if file_path:
                local_path = os.path.join(
                    settings.MEDIA_ROOT,
                    file_path.replace(settings.MEDIA_URL, "").lstrip("/")
                )
                if os.path.exists(local_path):
                    try:
                        os.remove(local_path)
                    except Exception:
                        pass
        super().delete(using=using, keep_parents=keep_parents)