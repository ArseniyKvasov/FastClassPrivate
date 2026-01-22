import random
import re
from courses.utils import task_image_upload_to
from django.db import models
from django.contrib.auth import get_user_model


User = get_user_model()


class TestTask(models.Model):
    """
    Содержит несколько вопросов в формате:
    [{"question": str, "options": [{"option": str, "is_correct": bool}]}]
    """
    questions = models.JSONField(default=list)
    total_answers = models.PositiveIntegerField(default=10)

    def save(self, *args, **kwargs):
        self.total_answers = len(self.questions) if self.questions else 0
        super().save(*args, **kwargs)


class TrueFalseTask(models.Model):
    """
    Содержит список утверждений для задачи типа "Правда/Ложь":
    [{"statement": str, "is_true": bool}]
    """
    statements = models.JSONField(default=list)
    total_answers = models.PositiveIntegerField(default=10)

    def save(self, *args, **kwargs):
        self.total_answers = len(self.statements) if self.statements else 0
        super().save(*args, **kwargs)


class NoteTask(models.Model):
    content = models.TextField()

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)


class ImageTask(models.Model):
    file = models.ImageField(
        upload_to=task_image_upload_to,
        max_length=255
    )
    caption = models.CharField(max_length=120, blank=True, null=True)

    def save(self, *args, **kwargs):
        if self.pk:
            old = ImageTask.objects.filter(pk=self.pk).first()
            if old and old.file and old.file != self.file:
                old.file.delete(save=False)

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.file:
            self.file.delete(save=False)
        super().delete(*args, **kwargs)


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
    answers = models.JSONField(default=list)
    task_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default="open"
    )
    total_answers = models.PositiveIntegerField(default=10)

    def save(self, *args, **kwargs):
        if self.task_type == "open":
            blanks_count = len(re.findall(r"\[(.*?)\]", self.text))
            self.total_answers = blanks_count
        else:
            self.total_answers = len(self.answers) if self.answers else 0
        super().save(*args, **kwargs)


class MatchCardsTask(models.Model):
    """
    Карточки в формате:
    [{"card_left": "cat", "card_right": "кот"}]
    """
    cards = models.JSONField(default=list)
    shuffled_cards = models.JSONField(default=list)
    total_answers = models.PositiveIntegerField(default=10)

    def save(self, *args, **kwargs):
        source = self.cards or []

        self.total_answers = len(source) if source else 0

        if len(source) > 1:
            left_parts = [c["card_left"] for c in source]
            right_parts = [c["card_right"] for c in source]

            random.shuffle(left_parts)
            random.shuffle(right_parts)

            mixed = []
            for i in range(len(source)):
                mixed.append({
                    "card_left": left_parts[i],
                    "card_right": right_parts[i]
                })

            self.shuffled_cards = mixed
        else:
            self.shuffled_cards = source[:]

        super().save(*args, **kwargs)


class TextInputTask(models.Model):
    prompt = models.CharField(max_length=255, blank=True)
    default_text = models.TextField("Текст по умолчанию", blank=True)

    def __str__(self):
        return self.prompt or "Без названия"


class IntegrationTask(models.Model):
    """
    Задание интеграции с внешними ресурсами.
    embed_code - очищенный HTML код для встраивания
    """
    embed_code = models.TextField(verbose_name="Встроенный код")

    def __str__(self):
        return f"Integration Task ({self.id})"
