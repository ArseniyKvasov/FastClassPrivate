from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from classroom.utils import generate_short_uuid, generate_invite_code

class Classroom(models.Model):
    id = models.CharField(
        primary_key=True,
        max_length=8,
        default=generate_short_uuid,
        editable=False,
        unique=True,
    )
    title = models.CharField(max_length=255)
    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="classrooms",
    )
    lesson = models.ForeignKey(
        "courses.Lesson",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="classrooms",
    )
    students = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name="joined_classrooms",
        blank=True,
    )
    invite_code = models.CharField(
        max_length=6,
        unique=True,
        default=generate_invite_code,
        editable=False,
    )

    class Meta:
        verbose_name = "Класс"
        verbose_name_plural = "Классы"

    def __str__(self):
        return f"{self.title} ({self.teacher.username})"

    @property
    def student_count(self):
        return self.students.count()

    @classmethod
    def join_by_code(cls, code, user):
        try:
            classroom = cls.objects.get(invite_code=code)
        except cls.DoesNotExist:
            raise ValidationError("Неверный код приглашения.")

        if classroom.teacher == user:
            raise ValidationError("Учитель не может присоединиться к своему классу как ученик.")

        if classroom.students.filter(id=user.id).exists():
            raise ValidationError("Вы уже присоединились к этому классу.")

        classroom.students.add(user)
        return classroom

    def remove_student(self, user):
        if not self.students.filter(id=user.id).exists():
            raise ValidationError("Этот пользователь не состоит в классе.")
        self.students.remove(user)
        return self

    def get_available_users(self, user):
        if self.teacher == user:
            available_users = list(self.students.all())
            available_users.append(self.teacher)
        else:
            available_users = [user]
        return available_users
