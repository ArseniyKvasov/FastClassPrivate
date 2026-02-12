import uuid
import random
from django.conf import settings
import os
from django.db import models


class TestTask(models.Model):
    __test__ = False
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    questions = models.JSONField(default=list)
    total_answers = models.PositiveIntegerField(default=10)

    def save(self, *args, **kwargs):
        self.total_answers = len(self.questions) if self.questions else 0
        super().save(*args, **kwargs)


class TrueFalseTask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    statements = models.JSONField(default=list)
    total_answers = models.PositiveIntegerField(default=10)

    def save(self, *args, **kwargs):
        self.total_answers = len(self.statements) if self.statements else 0
        super().save(*args, **kwargs)


class NoteTask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    content = models.TextField()

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)


class FillGapsTask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
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
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cards = models.JSONField(default=list)
    shuffled_cards = models.JSONField(default=list)
    total_answers = models.PositiveIntegerField(default=10)

    def save(self, *args, **kwargs):
        source = self.cards or []
        self.total_answers = len(source) if source else 0

        if len(source) > 1:
            left_parts = [c.get("card_left", "") for c in source]
            right_parts = [c.get("card_right", "") for c in source]

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
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prompt = models.CharField(max_length=255, blank=True)
    default_text = models.TextField("Текст по умолчанию", blank=True)

    def __str__(self):
        return self.prompt or "Без названия"


class IntegrationTask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    embed_code = models.TextField(verbose_name="Встроенный код")

    def __str__(self):
        return f"Integration Task ({self.id})"


class FileTask(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.FileField(upload_to='tasks/files/')

    def delete(self, *args, **kwargs):
        self.file.delete(save=False)
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"FileTask: {self.file.name}"