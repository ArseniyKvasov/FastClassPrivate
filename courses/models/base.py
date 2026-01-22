from django.db import models, transaction
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from courses.utils import generate_course_id

User = get_user_model()


class Course(models.Model):
    id = models.BigAutoField(primary_key=True)
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name="courses")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    version = models.IntegerField(default=1)
    is_public = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    def delete(self, using=None, keep_parents=False):
        """
        Удаляет все уроки, секции и задания через ORM,
        затем удаляет курс.
        """
        with transaction.atomic():
            self.lessons.all().delete()
            super().delete(using=using, keep_parents=keep_parents)


class Lesson(models.Model):
    id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.title} ({self.course.title})"

    def delete(self, using=None, keep_parents=False):
        """
        Удаляет все секции и связанные задания через ORM,
        затем удаляет урок.
        """
        with transaction.atomic():
            self.sections.all().delete()
            super().delete(using=using, keep_parents=keep_parents)


class Section(models.Model):
    id = models.BigAutoField(primary_key=True)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="sections")
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.title} ({self.lesson.title})"

    def delete(self, using=None, keep_parents=False):
        """
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
    id = models.BigAutoField(primary_key=True)
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="tasks")
    task_type = models.CharField(max_length=50, choices=TYPE_CHOICES, db_index=True)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField(db_index=True)
    specific = GenericForeignKey("content_type", "object_id")
    order = models.PositiveIntegerField(default=0, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        specific_title = getattr(self.specific, "title", None)
        return f"{self.get_task_type_display()}: {specific_title or 'Без названия'}"

    def get_specific(self):
        """
        Возвращает specific-объект задачи или None.
        Использовать вместо прямого обращения к self.specific.
        """
        try:
            return self.specific
        except Exception:
            return None

    def delete(self, using=None, keep_parents=False):
        super().delete(using=using, keep_parents=keep_parents)


@receiver(pre_delete, sender=Task)
def _task_pre_delete(sender, instance, using, **kwargs):
    """
    Гарантирует удаление specific-объекта перед удалением Task во всех сценариях,
    включая bulk delete через QuerySet.delete().
    """
    try:
        spec = instance.specific
        if spec is not None:
            spec.delete()
    except Exception:
        pass
