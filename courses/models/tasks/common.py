import random
from django.conf import settings
import os
from django.db import models


class TestTask(models.Model):
    questions = models.JSONField(default=list)
    total_answers = models.PositiveIntegerField(default=10)

    def save(self, *args, **kwargs):
        self.total_answers = len(self.questions) if self.questions else 0
        super().save(*args, **kwargs)


class TrueFalseTask(models.Model):
    statements = models.JSONField(default=list)
    total_answers = models.PositiveIntegerField(default=10)

    def save(self, *args, **kwargs):
        self.total_answers = len(self.statements) if self.statements else 0
        super().save(*args, **kwargs)


class NoteTask(models.Model):
    content = models.TextField()

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)


class FillGapsTask(models.Model):
    LIST_TYPE_CHOICES = [
        ("open", "Открытый ввод"),
        ("hidden", "Скрытый список слов"),
    ]

    text = models.TextField()
    answers = models.JSONField(default=list)
    list_type = models.CharField(
        max_length=20,
        choices=LIST_TYPE_CHOICES,
        default="open"
    )
    total_answers = models.PositiveIntegerField(default=10)

    def save(self, *args, **kwargs):
        self.total_answers = len(self.answers) if self.answers else 0
        super().save(*args, **kwargs)


class MatchCardsTask(models.Model):
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
    embed_code = models.TextField(verbose_name="Встроенный код")

    def __str__(self):
        return f"Integration Task ({self.id})"


class FileTask(models.Model):
    file_path = models.CharField(max_length=255)

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                old = FileTask.objects.get(pk=self.pk)
            except FileTask.DoesNotExist:
                old = None

            if old and old.file_path and old.file_path != self.file_path:
                old_local_path = os.path.join(
                    settings.MEDIA_ROOT,
                    old.file_path.replace(settings.MEDIA_URL, "").lstrip("/")
                )
                if os.path.exists(old_local_path):
                    os.remove(old_local_path)

        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        if self.file_path:
            local_path = os.path.join(
                settings.MEDIA_ROOT,
                self.file_path.replace(settings.MEDIA_URL, '').lstrip("/")
            )
            if os.path.exists(local_path):
                os.remove(local_path)
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"FileTask: {self.file_path}"