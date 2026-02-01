from django.db import models, transaction
from django.conf import settings
from django.core.exceptions import ValidationError
import random
from courses.models import Lesson, Course


def generate_join_password():
    """Генерирует случайный пароль из 4 цифр"""
    return "".join(random.choices("0123456789", k=4))


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
                self._delete_student_chat_messages(user)
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

    def _delete_student_chat_messages(self, user):
        from .base import ChatMessage
        deleted_count, _ = ChatMessage.objects.filter(classroom=self, sender=user).delete()
        if deleted_count > 0:
            print(f"Deleted {deleted_count} chat messages from {user.username}")

    def get_available_users(self, user):
        if self.teacher == user:
            available_users = list(self.students.all()) + [self.teacher]
        elif user in self.students.all():
            available_users = [user]
        else:
            available_users = []
        return available_users

    def attach_lesson(self, lesson):
        """Прикрепляет урок к классу"""
        if self.teacher != lesson.course.creator:
            if lesson.course.root_type == "clone":
                try:
                    with transaction.atomic():
                        copy_course = Course.objects.create(
                            creator=self.teacher,
                            linked_to=lesson.course,
                            root_type="copy",
                            title=lesson.course.title,
                            description=lesson.course.description,
                            subject=lesson.course.subject,
                            is_public=False
                        )
                        copy_course.synchronize_with_clone()

                        copy_lesson = copy_course.lessons.filter(linked_to=lesson).first()
                        if not copy_lesson:
                            raise ValidationError("Не удалось найти скопированный урок")

                        self.lesson = copy_lesson
                        self.save(update_fields=['lesson'])
                        return True
                except Exception as e:
                    raise ValidationError(f"Ошибка при копировании курса: {str(e)}")
            else:
                raise ValidationError("Вы не являетесь создателем этого курса")
        else:
            self.lesson = lesson
            self.save(update_fields=['lesson'])
            return True