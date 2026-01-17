import random
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


def generate_join_password():
    return f"{random.randint(1000, 9999)}"


class Classroom(models.Model):
    id = models.BigAutoField(primary_key=True)

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

    join_password = models.CharField(
        max_length=12,
        default=generate_join_password,
        help_text="пароль для входа в класс",
    )

    copying_enabled = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Класс"
        verbose_name_plural = "Классы"

    def __str__(self):
        return f"{self.title} ({self.teacher.username})"

    @property
    def student_count(self):
        return self.students.count()

    def join(self, user, password):
        """
        Подключает ученика к классу по паролю.
        """

        if user == self.teacher:
            raise ValidationError("Учитель не может войти в класс как ученик.")

        if self.students.filter(id=user.id).exists():
            raise ValidationError("Вы уже состоите в этом классе.")

        if password != self.join_password:
            raise ValidationError("Неверный пароль класса.")

        self.students.add(user)
        return self

    def remove_student(self, user):
        if not self.students.filter(id=user.id).exists():
            raise ValidationError("Этот пользователь не состоит в классе.")
        self.students.remove(user)
        return self

    def get_available_users(self, user):
        if self.teacher == user:
            available_users = list(self.students.all())
            available_users.append(self.teacher)
        elif user in self.students.all():
            available_users = [user]
        else:
            available_users = []
        return available_users
