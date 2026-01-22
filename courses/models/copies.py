from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey

User = get_user_model()


class CourseCopy(models.Model):
    """
    Копия курса.

    Используется при покупке курса пользователем
    """

    id = models.BigAutoField(primary_key=True)

    creator = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="course_copies",
        null=True,
    )

    original_course = models.ForeignKey(
        "courses.Course",
        on_delete=models.PROTECT,
        related_name="copies"
    )

    version = models.PositiveIntegerField(default=1)
    is_public = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("creator", "original_course", "version")

    def __str__(self):
        return f"{self.original_course.title} (v{self.version})"

class LessonCopy(models.Model):
    """
    Копия урока внутри CourseCopy.
    """

    id = models.BigAutoField(primary_key=True)

    course = models.ForeignKey(
        CourseCopy,
        on_delete=models.CASCADE,
        related_name="lessons"
    )

    original_lesson = models.ForeignKey(
        "courses.Lesson",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="copies",
    )

    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        unique_together = ("course", "original_lesson")

    def __str__(self):
        return self.title


class SectionCopy(models.Model):
    """
    Копия раздела внутри LessonCopy.
    """

    id = models.BigAutoField(primary_key=True)

    lesson = models.ForeignKey(
        LessonCopy,
        on_delete=models.CASCADE,
        related_name="sections"
    )

    original_section = models.ForeignKey(
        "courses.Section",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="copies",
    )

    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]
        unique_together = ("lesson", "original_section")

    def __str__(self):
        return self.title


class TaskCopy(models.Model):
    """
    Копия задания.

    edited_content хранит только изменения поверх оригинала.
    """

    id = models.BigAutoField(primary_key=True)

    section = models.ForeignKey(
        SectionCopy,
        on_delete=models.CASCADE,
        related_name="tasks"
    )

    original_task = models.ForeignKey(
        "courses.Task",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="copies"
    )

    task_type = models.CharField(max_length=50, db_index=True)

    edited_content = models.JSONField(default=dict, blank=True)

    order = models.PositiveIntegerField(default=0, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order"]
        indexes = [
            models.Index(fields=["section", "order"]),
        ]

    def __str__(self):
        return f"TaskCopy ({self.task_type})"

