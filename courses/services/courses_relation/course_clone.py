import os
from django.db import transaction
from django.core.files.base import ContentFile
from django.contrib.contenttypes.models import ContentType
from django.conf import settings

from courses.models import Course, Lesson, Section, Task


def _clone_file_path(file_path: str, *, version: int):
    """
    Клонирует файл по file_path, создавая физическую копию с новым именем.
    Возвращает новый путь для cloned файла (без /media/ префикса).
    """
    if not file_path:
        return None

    original_full_path = os.path.join(settings.MEDIA_ROOT, file_path)
    if not os.path.exists(original_full_path):
        return None

    base_name = os.path.basename(file_path)
    name, ext = os.path.splitext(base_name)
    cloned_name = f"{name}_clone_v{version}{ext}"

    relative_dir = os.path.dirname(file_path)
    cloned_relative_path = os.path.join(relative_dir, cloned_name)
    cloned_full_path = os.path.join(settings.MEDIA_ROOT, cloned_relative_path)

    os.makedirs(os.path.dirname(cloned_full_path), exist_ok=True)

    with open(original_full_path, "rb") as f_src, open(cloned_full_path, "wb") as f_dst:
        f_dst.write(f_src.read())

    return cloned_relative_path


@transaction.atomic
def clone_course_for_platform(course_from: Course, user_to):
    """
    Полное клонирование курса для платформы/нового пользователя.

    Алгоритм:
    - оригинальный курс увеличивает версию на 1
    - создаётся новый курс с увеличенной версией и новым id;
    - все уроки, секции и задания клонируются;
    - для каждого задания пересоздаётся specific и копируется file_path;
    - edited_content при клонировании сбрасывается.

    Примечание: Оригинальный курс остается активным.
    """
    course_from.version += 1
    course_from.save(update_fields=["version"])
    new_version = course_from.version

    new_course = Course.objects.create(
        creator=user_to,
        title=course_from.title,
        description=course_from.description,
        version=new_version,
        is_public=False,
    )

    for lesson in course_from.lessons.all().order_by("order"):
        new_lesson = Lesson.objects.create(
            course=new_course,
            title=lesson.title,
            description=lesson.description,
            order=lesson.order,
        )

        for section in lesson.sections.all().order_by("order"):
            new_section = Section.objects.create(
                lesson=new_lesson,
                title=section.title,
                order=section.order,
            )

            for task in section.tasks.all().order_by("order"):
                spec = task.get_specific()
                new_spec = None

                if spec is not None:
                    spec_model = spec.__class__
                    spec_fields = {}

                    for field in spec_model._meta.fields:
                        if field.name == "id":
                            continue

                        value = getattr(spec, field.name)

                        if field.name == "file_path":
                            cloned_file_path = _clone_file_path(value, version=new_version)
                            if cloned_file_path:
                                spec_fields[field.name] = cloned_file_path
                            else:
                                spec_fields[field.name] = ""
                            continue

                        spec_fields[field.name] = value

                    new_spec = spec_model.objects.create(**spec_fields)

                content_type = ContentType.objects.get_for_model(new_spec) if new_spec else None
                object_id = new_spec.id if new_spec else None

                Task.objects.create(
                    section=new_section,
                    task_type=task.task_type,
                    content_type=content_type,
                    object_id=object_id,
                    edited_content={},
                    order=task.order,
                )

    return new_course