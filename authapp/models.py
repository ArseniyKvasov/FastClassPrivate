import uuid
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models


class User(AbstractUser):
    """
    - Telegram не обязателен.
    - Привязка Telegram автоматически даёт полный доступ.
    - Полный доступ невозможен без Telegram.
    """

    has_full_access = models.BooleanField(default=False)

    telegram_id = models.CharField(
        max_length=50,
        unique=True,
        null=True,
        blank=True
    )

    telegram_username = models.CharField(
        max_length=50,
        null=True,
        blank=True
    )

    marketing_consent = models.BooleanField(default=True)

    def clean(self):
        if self.has_full_access and not self.telegram_id:
            raise ValidationError(
                "Полный доступ невозможен без привязанного Telegram."
            )

        if self.telegram_id and not self.has_full_access:
            raise ValidationError(
                "Пользователь с Telegram обязан иметь полный доступ."
            )

        if not self.password:
            raise ValidationError(
                {"password": ["This field cannot be blank."]}
            )

    def save(self, *args, **kwargs):
        if self.telegram_id:
            self.has_full_access = True

        if not self.password:
            self.set_unusable_password()

        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def display_name(self):
        if self.first_name:
            if self.last_name:
                return f"{self.first_name} {self.last_name[0]}."
            return self.first_name

        return self.telegram_username or "Пользователь"

    def __str__(self):
        return self.display_name

    @classmethod
    def _generate_username(cls) -> str:
        return f"user_{uuid.uuid4().hex[:12]}"

    @classmethod
    def create_limited_user(cls, first_name: str, last_name: str) -> "User":
        user = cls(
            username=cls._generate_username(),
            first_name=first_name,
            last_name=last_name,
            has_full_access=False,
        )
        user.set_unusable_password()
        user.save()
        return user

    @classmethod
    def create_full_user_with_telegram(
            cls,
            telegram_id: str,
            telegram_username: str | None = None,
            first_name: str | None = None,
            last_name: str | None = None,
            marketing_consent: bool = True,
    ) -> "User":
        user = cls(
            username=cls._generate_username(),
            telegram_id=telegram_id,
            telegram_username=telegram_username,
            first_name=first_name or "",
            last_name=last_name or "",
            has_full_access=True,
            marketing_consent=marketing_consent,
        )
        user.set_unusable_password()
        user.save()
        return user