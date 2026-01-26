import os
from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from django.db import models, transaction
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
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
    id = models.BigAutoField(primary_key=True)
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name="courses")

    original_course = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="copies",
        help_text="Оригинальный курс, если это копия"
    )

    new_version = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="previous_version",
        help_text="Новая версия этого курса"
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
        if self.deactivated_at is not None:
            return False
        return True

    def deactivate(self):
        if self.is_active:
            self.deactivated_at = timezone.now()
            self.save(update_fields=['deactivated_at'])

    def activate(self):
        if self.deactivated_at is not None:
            self.deactivated_at = None
            self.save(update_fields=['deactivated_at'])

    def get_latest_version(self):
        current = self
        while current.new_version is not None and current.new_version.is_public:
            current = current.new_version
        return current

    def clean(self):
        """Валидация данных перед сохранением"""
        super().clean()

        if self.new_version:
            self._validate_no_cycle()

        if self.new_version == self:
            raise ValidationError({
                'new_version': 'Курс не может быть новой версией самого себя'
            })

        if self.original_course and self.new_version and self.original_course == self.new_version:
            raise ValidationError(
                'Оригинальный курс и новая версия не могут ссылаться на один и тот же объект'
            )

    def _validate_no_cycle(self):
        """
        Проверка на циклические зависимости в цепочке версий.
        Использует алгоритм обнаружения цикла в связном списке.
        """
        slow = self.new_version
        fast = self.new_version.new_version if self.new_version else None

        visited_ids = {self.id}

        while fast and fast.new_version:
            if slow.id == self.id or fast.id == self.id:
                raise ValidationError({
                    'new_version': 'Обнаружена циклическая зависимость в цепочке версий'
                })

            if slow.id == fast.id:
                raise ValidationError({
                    'new_version': 'Обнаружена циклическая зависимость в цепочке версий'
                })

            if slow.id in visited_ids or fast.id in visited_ids:
                raise ValidationError({
                    'new_version': 'Обнаружена циклическая зависимость в цепочке версий'
                })

            visited_ids.add(slow.id)
            visited_ids.add(fast.id)

            slow = slow.new_version
            fast = fast.new_version.new_version if fast.new_version else None

            if not slow or not fast:
                break

    def _check_version_chain_cycle(self):
        """
        Альтернативный метод проверки циклов - обход всей цепочки.
        """
        visited = set()
        current = self.new_version

        while current:
            if current.id == self.id:
                raise ValidationError({
                    'new_version': 'Обнаружена циклическая зависимость: курс ссылается на себя через цепочку версий'
                })

            if current.id in visited:
                raise ValidationError({
                    'new_version': 'Обнаружена циклическая зависимость в цепочке версий'
                })

            visited.add(current.id)
            current = current.new_version

    def save(self, *args, **kwargs):
        """
        Переопределенный save с валидацией перед сохранением.
        """
        self.full_clean()

        if self.new_version:
            self._validate_no_cycle()
            self._check_version_chain_cycle()

        if self.new_version and not self.pk:
            latest = self.get_latest_version_in_chain()
            self.version = latest.version + 1 if latest else 1

        super().save(*args, **kwargs)

    def get_latest_version_in_chain(self):
        """Получить последнюю версию в цепочке, начиная с текущего курса"""
        current = self
        while current.new_version is not None:
            current = current.new_version
        return current

    def delete(self, using=None, keep_parents=False):
        """
        Безопасное удаление курса с обработкой связей версий.
        """
        with transaction.atomic():
            Course.objects.filter(new_version=self).update(new_version=None)

            for lesson in self.lessons.all():
                lesson.delete()

            super().delete(using=using, keep_parents=keep_parents)

    @classmethod
    def get_version_chain(cls, course_id):
        """
        Получить всю цепочку версий для курса.
        Возвращает список курсов в порядке от старого к новому.
        """
        try:
            course = cls.objects.get(id=course_id)
        except cls.DoesNotExist:
            return []

        chain = []
        current = course

        while current.previous_version.exists():
            current = current.previous_version.first()

        while current:
            chain.append(current)
            current = current.new_version

        return chain

    class Meta:
        app_label = "courses"
        indexes = [
            models.Index(fields=['deactivated_at']),
            models.Index(fields=['original_course']),
            models.Index(fields=['new_version']),
        ]
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(new_version=models.F('id')),
                name='course_not_reference_itself'
            ),
        ]


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
