import os
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import models, transaction
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.dispatch import receiver

User = get_user_model()

SUBJECT_CHOICES = [
    ("math", "Математика"),
    ("english", "Английский"),
    ("other", "Другое"),
]

TYPE_CHOICES = [
    ("test", "Тест"),
    ("note", "Заметка"),
    ("image", "Изображение"),
    ("true_false", "Правда или ложь"),
    ("fill_gaps", "Заполнить пропуски"),
    ("match_cards", "Соотнести карточки"),
    ("text_input", "Ввод текста"),
]


class Course(models.Model):
    """
    Course может быть оригиналом или копией.
    Поле original_course указывает на исходный курс (может быть null для оригинала).
    Поле new_version_course указывает на новую версию этого курса.
    Если new_version_course указан, текущий курс считается неактивным.
    """
    id = models.BigAutoField(primary_key=True)
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name="courses")

    # Ссылка на оригинальный курс (для копий)
    original_course = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="copies",
        help_text="Оригинальный курс, если это копия"
    )

    new_version_course = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="previous_versions",
        help_text="Новая версия этого курса, если есть"
    )

    version = models.IntegerField(default=1)

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    subject = models.CharField(max_length=20, choices=SUBJECT_CHOICES, default="other")
    is_public = models.BooleanField(default=False)
    deactivated_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} (v{self.version})"

    @property
    def is_active(self):
        """
        Вычисляемое свойство - активен ли курс.
        Курс неактивен если:
        1. Указано поле deactivated_at
        2. ИЛИ есть новая версия курса (new_version_course)
        """
        if self.deactivated_at is not None:
            return False
        if self.new_version_course is not None:
            return False
        return True

    def deactivate(self):
        if self.is_active:
            self.deactivated_at = timezone.now()
            self.save(update_fields=['deactivated_at'])

    def activate(self):
        """
        Активировать курс.
        """
        if self.deactivated_at is not None:
            self.deactivated_at = None
            self.save(update_fields=['deactivated_at'])

    def set_as_new_version_for(self, previous_course):
        """
        Установить этот курс как новую версию для предыдущего курса
        и для всей его цепочки предыдущих версий.

        Args:
            previous_course: Курс, для которого этот курс становится новой версией
        """
        with transaction.atomic():
            chain = previous_course.get_version_chain_with_previous()

            for course_in_chain in chain:
                if not course_in_chain.new_version_course:
                    course_in_chain.new_version_course = self
                    if course_in_chain.deactivated_at is None:
                        course_in_chain.deactivated_at = timezone.now()
                    course_in_chain.save(
                        update_fields=['new_version_course', 'deactivated_at']
                    )

            if not self.original_course:
                original = chain[0].original_course if chain[0].original_course else chain[0]
                self.original_course = original
                self.save(update_fields=['original_course'])

    def get_latest_version(self):
        """
        Получить самую последнюю версию курса.

        Returns:
            Course: Самая последняя версия курса в цепочке обновлений
        """
        current = self

        while current.new_version_course is not None:
            current = current.new_version_course

        return current

    def get_version_chain(self):
        """
        Получить цепочку всех версий курса от текущей до последней.

        Returns:
            list: Список курсов в порядке от текущего к последнему
        """
        chain = [self]
        current = self

        while current.new_version_course is not None:
            current = current.new_version_course
            chain.append(current)

        return chain

    def get_version_chain_with_previous(self):
        """
        Получить всю цепочку версий курса, включая предыдущие версии.

        Returns:
            list: Список всех курсов в цепочке от самой старой до самой новой
        """
        oldest = self
        while True:
            previous_versions = Course.objects.filter(new_version_course=oldest)
            if previous_versions.exists():
                oldest = previous_versions.first()
            else:
                break

        chain = []
        current = oldest

        while current:
            chain.append(current)
            current = current.new_version_course

        return chain

    def get_previous_version(self):
        """
        Получить предыдущую версию курса.

        Returns:
            Course or None: Предыдущая версия курса, если существует
        """
        try:
            return self.previous_versions.first()
        except AttributeError:
            return None

    def has_newer_version(self):
        """
        Проверка, есть ли у курса более новая версия.
        """
        return self.new_version_course is not None

    def delete(self, using=None, keep_parents=False):
        """
        Безопасное удаление курса со всеми уроками, разделами и заданиями.
        """
        with transaction.atomic():
            Course.objects.filter(new_version_course=self).update(
                new_version_course=None,
                deactivated_at=None
            )

            for lesson in self.lessons.all():
                lesson.delete()

            super().delete(using=using, keep_parents=keep_parents)

    def save(self, *args, **kwargs):
        """
        Переопределяем save для автоматической деактивации при указании новой версии.
        """
        if self.new_version_course and not self.deactivated_at:
            self.deactivated_at = timezone.now()

        super().save(*args, **kwargs)

    class Meta:
        app_label = "courses"
        indexes = [
            models.Index(fields=['deactivated_at']),
            models.Index(fields=['original_course']),
            models.Index(fields=['new_version_course']),
        ]
        ordering = ['-created_at']


class Lesson(models.Model):
    """
    Lesson может быть оригиналом или копией.
    Поле original_lesson указывает на исходный урок (может быть null).
    """
    id = models.BigAutoField(primary_key=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="lessons")
    original_lesson = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="copies",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        app_label = "courses"
        ordering = ["order"]

    def __str__(self):
        return f"{self.title} ({self.course.title})"

    def delete(self, using=None, keep_parents=False):
        with transaction.atomic():
            for section in self.sections.all():
                section.delete()
            super().delete(using=using, keep_parents=keep_parents)


class Section(models.Model):
    """
    Section может быть оригиналом или копией.
    Поле original_section указывает на исходный раздел (может быть null).
    """
    id = models.BigAutoField(primary_key=True)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="sections")
    original_section = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="copies",
    )
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        app_label = "courses"
        ordering = ["order"]

    def __str__(self):
        return f"{self.title} ({self.lesson.title})"

    def delete(self, using=None, keep_parents=False):
        with transaction.atomic():
            for task in self.tasks.all():
                task.delete()
            super().delete(using=using, keep_parents=keep_parents)


class Task(models.Model):
    """
    Базовая модель задания. specific хранит payload через GenericForeignKey.
    edited_content хранит пользовательские изменения поверх оригинального specific.
    """
    id = models.BigAutoField(primary_key=True)
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name="tasks")

    task_type = models.CharField(max_length=50, choices=TYPE_CHOICES, db_index=True)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField(db_index=True)
    specific = GenericForeignKey("content_type", "object_id")

    original_task = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="copies"
    )

    edited_content = models.JSONField(default=dict, blank=True)
    order = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "courses"
        ordering = ["order"]

    def __str__(self):
        specific_title = getattr(self.specific, "title", None)
        return f"{self.get_task_type_display()}: {specific_title or 'Без названия'}"

    def get_specific(self):
        try:
            return self.specific
        except Exception:
            return None

    def delete(self, using=None, keep_parents=False):
        """
        Удаление задания с учетом edited_content и specific.

        1) Если задание оригинальное (original_task is None):
           - удаляем specific
           - specific сам удаляет свой файл (например, ImageTask)
        2) Если задание копия (original_task != None):
           - удаляем файл из edited_content, если он существует
           - original specific не трогаем
        """
        if not self.original_task:
            spec = self.get_specific()
            if spec is not None:
                try:
                    spec.delete()
                except Exception:
                    pass

        else:
            file_path = self.edited_content.get("file_path")
            if file_path:
                local_path = os.path.join(
                    settings.MEDIA_ROOT,
                    file_path.replace(settings.MEDIA_URL, "").lstrip("/")
                )
                if os.path.exists(local_path):
                    try:
                        os.remove(local_path)
                    except Exception:
                        pass

        super().delete(using=using, keep_parents=keep_parents)
