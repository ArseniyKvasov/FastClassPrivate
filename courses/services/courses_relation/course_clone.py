import os
from django.db import transaction
from django.core.files.base import ContentFile
from django.contrib.contenttypes.models import ContentType

from courses.models import Course, Lesson, Section, Task


def _clone_file_field(file_field, *, version):
    """
    Клонирует FileField, создавая физическую копию файла.

    Имя файла сохраняется, но перед расширением добавляется `_clone_v{version}`.
    """
    if not file_field or not file_field.name:
        return None

    original_name = os.path.basename(file_field.name)
    name, ext = os.path.splitext(original_name)
    cloned_name = f"{name}_clone_v{version}{ext}"

    file_field.open("rb")
    content = ContentFile(file_field.read())
    file_field.close()

    return cloned_name, content


def clone_course_for_platform(course_from, user_to):
    """
    Безопасное обновление или публикация курса для платформы.

    Поведение:
    - создаёт новый курс с новой версией и новым id
    - старый курс помечается как неактивный (is_active=False)
    - все файлы и задания клонируются
    - старые пользователи продолжают использовать старый курс без проблем
    """
    with transaction.atomic():
        # увеличиваем версию исходного курса
        course_from.version += 1
        course_from.save(update_fields=["version"])
        new_version = course_from.version

        # помечаем старый курс как неактивный для новых покупателей
        course_from.is_active = False
        course_from.save(update_fields=["is_active"])

        # создаём новый курс
        new_course = Course.objects.create(
            creator=user_to,
            title=course_from.title,
            description=course_from.description,
            version=new_version,
            is_public=True,
            is_active=True,
        )

        for lesson in course_from.lessons.all():
            new_lesson = Lesson.objects.create(
                course=new_course,
                title=lesson.title,
                description=lesson.description,
                order=lesson.order,
            )

            for section in lesson.sections.all():
                new_section = Section.objects.create(
                    lesson=new_lesson,
                    title=section.title,
                    order=section.order,
                )

                for task in section.tasks.all():
                    spec = task.get_specific()
                    new_spec = None

                    if spec is not None:
                        spec_model = spec.__class__
                        spec_fields = {}

                        for field in spec_model._meta.fields:
                            if field.name == "id":
                                continue

                            value = getattr(spec, field.name)

                            if field.name == "file":
                                cloned = _clone_file_field(value, version=new_version)
                                if cloned:
                                    spec_fields[field.name] = cloned
                                continue

                            spec_fields[field.name] = value

                        new_spec = spec_model.objects.create(
                            **{
                                k: v
                                for k, v in spec_fields.items()
                                if not isinstance(v, tuple)
                            }
                        )

                        for field_name, payload in spec_fields.items():
                            if isinstance(payload, tuple):
                                filename, content = payload
                                getattr(new_spec, field_name).save(
                                    filename,
                                    content,
                                    save=False,
                                )

                        new_spec.save()

                    content_type = None
                    object_id = None

                    if new_spec is not None:
                        content_type = ContentType.objects.get_for_model(new_spec)
                        object_id = new_spec.id

                    Task.objects.create(
                        section=new_section,
                        task_type=task.task_type,
                        content_type=content_type,
                        object_id=object_id,
                        order=task.order,
                    )

        return new_course