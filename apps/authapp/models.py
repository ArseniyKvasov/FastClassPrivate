from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db.models import Q, UniqueConstraint


class UserManager(BaseUserManager):
    def create_user(self, username, email=None, password=None, **extra_fields):
        if not username:
            raise ValueError("The username must be set")
        email = self.normalize_email(email) if email else None
        user = self.model(username=username, email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if not password:
            raise ValueError("Superuser must have a password")
        return self.create_user(username, email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(null=True, blank=True)
    vk_id = models.CharField(max_length=512, null=True, blank=True)
    yandex_id = models.CharField(max_length=512, null=True, blank=True)

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    class Meta:
        constraints = [
            UniqueConstraint(fields=["email"], condition=Q(email__isnull=False), name="unique_email_non_null"),
            UniqueConstraint(fields=["vk_id"], condition=Q(vk_id__isnull=False), name="unique_vk_non_null"),
            UniqueConstraint(fields=["yandex_id"], condition=Q(yandex_id__isnull=False), name="unique_yandex_non_null"),
        ]

    def __str__(self):
        return self.username