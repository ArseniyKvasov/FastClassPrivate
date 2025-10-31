import random
import string
from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
import uuid

from django.utils.timezone import now

User = get_user_model()


def generate_course_id():
    """Генерирует уникальный 8-символьный id для курса"""
    chars = string.ascii_letters + string.digits
    from .models import Course
    while True:
        new_id = ''.join(random.choices(chars, k=8))
        if not Course.objects.filter(id=new_id).exists():
            return new_id


class Course(models.Model):
    id = models.CharField(
        primary_key=True,
        max_length=8,
        editable=False,
        default=generate_course_id
    )
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name="courses")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Lesson(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    is_free = models.BooleanField(default=False)
    is_open = models.BooleanField(default=False)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.title} ({self.course.title})"


class Section(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="sections")
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.title} ({self.lesson.title})"


class Task(models.Model):
    TYPE_CHOICES = [
        ("test", "Тест"),
        ("note", "Заметка"),
        ("image", "Изображение"),
        ("true_false", "Правда или ложь"),
        ("fill_gaps", "Заполнить пропуски"),
        ("match_cards", "Соотнести карточки"),
        ("text_input", "Ввод текста"),
    ]

    id = models.CharField(
        primary_key=True,
        max_length=50,
        default=uuid.uuid4,
        editable=False,
    )
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="tasks")
    task_type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    specific = GenericForeignKey("content_type", "object_id")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        specific_title = getattr(self.specific, "title", None)
        return f"{self.get_task_type_display()}: {specific_title or 'Без названия'}"


class TestTask(models.Model):
    """
    Содержит:
     текстовый вопрос
     варианты ответов options = [{"option": str, is_correct: bool}]
    """
    question = models.TextField()
    options = models.JSONField()

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)


class NoteTask(models.Model):
    content = models.TextField()

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)


def task_image_upload_to(instance, filename):
    """
    Генерируем уникальное имя файла.
    Формат: tasks/images/<UUID>_<timestamp>.<ext>
    """
    ext = filename.split('.')[-1]
    unique_id = uuid.uuid4().hex
    timestamp = now().strftime("%Y%m%d%H%M%S")
    return f"tasks/images/{unique_id}_{timestamp}.{ext}"


class ImageTask(models.Model):
    image = models.ImageField(
        upload_to=task_image_upload_to,
        max_length=255
    )
    caption = models.CharField(max_length=120, blank=True, null=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Удаляем файл с диска перед удалением объекта
        if self.image:
            self.image.delete(save=False)
        super().delete(*args, **kwargs)


class TrueFalseTask(models.Model):
    statement = models.TextField()
    is_true = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)


class FillGapsTask(models.Model):
    """
    Тип задания: заполнить пропуски.

    Поддерживает два формата:
        1) open     — ученик видит список ответов
        2) hidden   — пропуски со скрытым списком слов

    Пример текста:
        "She has lived in [London] for [five] years."

    answers сохраняет список правильных ответов:
        ["London", "five"]
    """

    TYPE_CHOICES = [
        ("open", "Открытый ввод"),
        ("hidden", "Скрытый список слов"),
    ]

    text = models.TextField()
    answers = models.JSONField()
    task_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default="open"
    )

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)


class MatchCardsTask(models.Model):
    """
    Карточки в формате [{"left_card": "cat", "right_card": "кот"}]
    """
    cards = models.JSONField()

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)


class TextInputTask(models.Model):
    prompt = models.CharField(max_length=255, blank=True)
    default_text = models.TextField("Текст по умолчанию", blank=True)

    def __str__(self):
        return self.prompt or "Без названия"
