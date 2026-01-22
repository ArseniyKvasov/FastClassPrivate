from django.db import models, transaction
from django.conf import settings
from django.core.exceptions import ValidationError

from courses.models import Lesson, LessonCopy


def generate_join_password():
    import random, string
    return "".join(random.choices(string.ascii_letters + string.digits, k=12))


class Classroom(models.Model):
    id = models.BigAutoField(primary_key=True)
    title = models.CharField(max_length=255)

    teacher = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="classrooms",
    )

    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="classrooms",
    )

    lesson_copy = models.ForeignKey(
        LessonCopy,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="classrooms_copy",
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
            return {
                "success": False,
                "removed": False,
                "error": "Этот пользователь не состоит в классе"
            }
        with transaction.atomic():
            try:
                self._delete_student_answers(user)
                self.students.remove(user)
                return {
                    "success": True,
                    "removed": True,
                    "student_id": user.id,
                    "remaining_students": self.students.count()
                }
            except Exception as e:
                transaction.set_rollback(True)
                return {
                    "success": False,
                    "removed": False,
                    "error": f"Ошибка при удалении: {str(e)}"
                }

    def _delete_student_answers(self, user):
        try:
            from classroom.registry import get_all_answer_models
            answer_models = get_all_answer_models()
            for model in answer_models:
                deleted_count, _ = model.objects.filter(user=user, classroom=self).delete()
                if deleted_count > 0:
                    print(f"Deleted {deleted_count} answers from {model.__name__}")
        except ImportError:
            pass

    def get_available_users(self, user):
        if self.teacher == user:
            available_users = list(self.students.all()) + [self.teacher]
        elif user in self.students.all():
            available_users = [user]
        else:
            available_users = []
        return available_users

    def get_attached_lesson(self):
        """
        Возвращает словарь с привязанным уроком:
        {"id": int, "is_copy": bool} или None, если урок не привязан.
        """
        if self.lesson_copy:
            return {"id": self.lesson_copy.id, "is_copy": True}
        elif self.lesson:
            return {"id": self.lesson.id, "is_copy": False}
        return None

    def attach_lesson(self, lesson_obj, user):
        """
        Привязывает Lesson или LessonCopy к классу.
        Проверяет, является ли пользователь создателем оригинального курса.
        """
        from courses.services import create_course_copy_for_user

        if isinstance(lesson_obj, Lesson):
            if lesson_obj.course.creator == user:
                self.lesson = lesson_obj
                self.lesson_copy = None
            else:
                course_copy = create_course_copy_for_user(lesson_obj.course, user, keep_user_content=True)
                lesson_copy = course_copy.lessons.filter(original_lesson=lesson_obj).first()
                if not lesson_copy:
                    raise ValueError("LessonCopy not found")
                self.lesson = None
                self.lesson_copy = lesson_copy
        elif isinstance(lesson_obj, LessonCopy):
            self.lesson_copy = lesson_obj
            self.lesson = None
        else:
            raise TypeError("Можно привязать только Lesson или LessonCopy")

        self.save(update_fields=["lesson", "lesson_copy"])