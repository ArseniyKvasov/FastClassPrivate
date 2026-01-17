from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = [
        ("teacher", "Учитель"),
        ("student", "Ученик"),
    ]

    username = models.CharField(max_length=150, unique=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)

    vk_id = models.CharField(max_length=50, blank=True, null=True, unique=True)
    telegram_id = models.CharField(max_length=50, blank=True, null=True, unique=True)
    telegram_username = models.CharField(max_length=50, blank=True, null=True)

    @property
    def is_teacher(self):
        return self.role == "teacher"

    @property
    def is_student(self):
        return self.role == "student"

    def __str__(self):
        return f"{self.username} ({self.role})"
