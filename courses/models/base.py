import uuid
from django.db import models, transaction
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from courses.utils import generate_course_id

User = get_user_model()


class Course(models.Model):
    id = models.CharField(
        primary_key=True,
        max_length=8,
        editable=False,
        default=generate_course_id
    )
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name="courses")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    def delete(self, using=None, keep_parents=False):
        """
        dogstring:
        Удаляет все задания (через ORM, чтобы сработали сигналы/логика удаления),
        затем удаляет курс в транзакции.
        """
        with transaction.atomic():
            for lesson in self.lessons.all():
                lesson.delete()
            super().delete(using=using, keep_parents=keep_parents)


class Lesson(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    is_free = models.BooleanField(default=False)
    is_open = models.BooleanField(default=False)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.title} ({self.course.title})"

    def delete(self, using=None, keep_parents=False):
        """
        dogstring:
        Удаляет секции и связанные задания, затем удаляет урок.
        """
        with transaction.atomic():
            for section in self.sections.all():
                section.delete()
            super().delete(using=using, keep_parents=keep_parents)


class Section(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="sections")
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.title} ({self.lesson.title})"

    def delete(self, using=None, keep_parents=False):
        """
        dogstring:
        Удаляет все задания раздела через ORM (чтобы сработали сигналы),
        затем удаляет сам раздел.
        """
        with transaction.atomic():
            # удаляем задания через .all().delete() — сработают pre_delete/post_delete для Task
            self.tasks.all().delete()
            super().delete(using=using, keep_parents=keep_parents)


TYPE_CHOICES = [
    ("test", "Тест"),
    ("note", "Заметка"),
    ("image", "Изображение"),
    ("true_false", "Правда или ложь"),
    ("fill_gaps", "Заполнить пропуски"),
    ("match_cards", "Соотнести карточки"),
    ("text_input", "Ввод текста"),
]


class Task(models.Model):
    id = models.CharField(
        primary_key=True,
        max_length=50,
        default=uuid.uuid4,
        editable=False,
    )
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="tasks")
    task_type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    specific = GenericForeignKey("content_type", "object_id")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        specific_title = getattr(self.specific, "title", None)
        return f"{self.get_task_type_display()}: {specific_title or 'Без названия'}"

    def delete(self, using=None, keep_parents=False):
        """
        dogstring:
        При ручном удалении задачи через instance.delete() сначала удаляем
        связанный specific-объект, затем сам Task.
        """
        with transaction.atomic():
            try:
                spec = self.specific
                if spec is not None:
                    spec.delete()
            except Exception:
                pass
            super().delete(using=using, keep_parents=keep_parents)


@receiver(pre_delete, sender=Task)
def _task_pre_delete(sender, instance, using, **kwargs):
    """
    dogstring:
    Гарантирует удаление specific-объекта перед удалением Task во всех сценариях,
    включая bulk delete через QuerySet.delete().
    """
    try:
        spec = instance.specific
        if spec is not None:
            spec.delete()
    except Exception:
        pass
