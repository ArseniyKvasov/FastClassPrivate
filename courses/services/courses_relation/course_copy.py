from collections import defaultdict
from typing import List, Optional, Dict, Any

from django.db import transaction

from courses.models import Course, Lesson, Section, Task


@transaction.atomic
def create_course_copy_for_user(course: Course, user, keep_user_content: bool = True) -> Course:
    """
    Создаёт или обновляет копию курса для пользователя.

    При первом создании:
    - копируются Lesson и Section как обычные объекты с ссылкой на original_*;
    - для каждой Task оригинального курса создаётся новая Task в копии курса с
      original_task = <оригинальная Task> и пустым edited_content.

    При обновлении:
    - синхронизируется структура по алгоритму predecessor (см. sync_course_copy_with_user),
      учитывается флаг keep_user_content:
        * если False — пользовательские объекты удаляются и сбрасываются edited_content,
          заголовки Lesson/Section приводятся к оригинальным;
        * если True — пользовательские объекты сохраняются и располагаются относительно
          своих предшественников.
    """
    course_copy, created = Course.objects.get_or_create(
        creator=user,
        original_course=course,
        defaults={
            "title": course.title,
            "description": course.description,
            "version": getattr(course, "version", 1),
            "is_public": False,
        }
    )

    if created:
        _populate_course_copy(course, course_copy)
    else:
        sync_course_copy_with_user(course_copy, course, keep_user_content=keep_user_content)

    normalize_order(course_copy)
    return course_copy


def _populate_course_copy(original_course: Course, course_copy: Course) -> None:
    """
    Первичное копирование структуры: создаёт Lesson/Section и создаёт Task-копии
    как обычные Task с полем original_task, edited_content = {}.
    """
    lesson_order = 0
    for lesson in original_course.lessons.all().order_by("order"):
        lesson_order += 1
        lesson_copy = Lesson.objects.create(
            course=course_copy,
            original_lesson=lesson,
            title=lesson.title,
            order=lesson_order,
        )

        section_order = 0
        for section in lesson.sections.all().order_by("order"):
            section_order += 1
            section_copy = Section.objects.create(
                lesson=lesson_copy,
                original_section=section,
                title=section.title,
                order=section_order,
            )

            task_order = 0
            for task in section.tasks.all().order_by("order"):
                task_order += 1
                Task.objects.create(
                    section=section_copy,
                    original_task=task,
                    task_type=task.task_type,
                    content_type=task.content_type,
                    object_id=task.object_id,
                    edited_content={},
                    order=task_order,
                )


@transaction.atomic
def sync_course_copy_with_user(course_copy: Course, original_course: Course, keep_user_content: bool = True) -> None:
    """
    Синхронизирует копию курса с оригиналом по алгоритму:
      1) удаляет объекты, привязанные к оригиналу, которых больше нет в оригинале;
      2) сохраняет predecessor для пользовательских объектов;
      3) вставляет оригинальные объекты в порядке оригинала и располагает пользовательские
         объекты после их предшественников;
      4) если keep_user_content=False — удаляет пользовательские объекты и сбрасывает edited_content,
         а также сбрасывает заголовки Lessons/Sections до оригинальных.
      5) в конце проставляет корректные order для всех уровней.
    """
    course_copy.title = original_course.title
    course_copy.description = original_course.description
    course_copy.version = getattr(original_course, "version", course_copy.version)
    course_copy.save(update_fields=["title", "description", "version"])

    # 1) Уроки: удалить копии оригиналов, которых больше нет
    orig_lesson_ids = {l.id for l in original_course.lessons.all()}
    for lesson in list(course_copy.lessons.all()):
        if lesson.original_lesson_id and lesson.original_lesson_id not in orig_lesson_ids:
            lesson.delete()

    if not keep_user_content:
        # удалить уроки, созданные пользователем (без original_lesson)
        course_copy.lessons.filter(original_lesson__isnull=True).delete()

    # перестроение уроков с запоминанием predecessor для пользовательских уроков
    existing_lessons = list(course_copy.lessons.all().order_by("order", "id"))
    user_lesson_predecessor: Dict[Any, Optional[Any]] = {}
    prev = None
    for l in existing_lessons:
        if not l.original_lesson_id:
            user_lesson_predecessor[l.id] = prev.id if prev else None
        prev = l

    new_lessons: List[Lesson] = []
    orig_lessons = list(original_course.lessons.all().order_by("order"))
    for orig in orig_lessons:
        lesson_copy = next((l for l in existing_lessons if l.original_lesson_id == orig.id), None)
        if lesson_copy:
            if not keep_user_content:
                lesson_copy.title = orig.title
            lesson_copy.save(update_fields=["title"])
        else:
            lesson_copy = Lesson.objects.create(
                course=course_copy,
                original_lesson=orig,
                title=orig.title,
                order=0,
            )
        new_lessons.append(lesson_copy)

    remaining_user_lessons = [l for l in existing_lessons if not l.original_lesson_id]
    for user_lesson in remaining_user_lessons:
        pred_id = user_lesson_predecessor.get(user_lesson.id)
        if pred_id is None:
            new_lessons.insert(0, user_lesson)
        else:
            idx = next((i for i, it in enumerate(new_lessons) if it.id == pred_id), None)
            if idx is None:
                new_lessons.append(user_lesson)
            else:
                new_lessons.insert(idx + 1, user_lesson)

    # Синхронизация секций и заданий внутри каждого урока
    for lesson_copy in new_lessons:
        orig_lesson = lesson_copy.original_lesson

        if orig_lesson:
            orig_section_ids = {s.id for s in orig_lesson.sections.all()}
            for s in list(lesson_copy.sections.all()):
                if s.original_section_id and s.original_section_id not in orig_section_ids:
                    s.delete()

        if not keep_user_content:
            lesson_copy.sections.filter(original_section__isnull=True).delete()

        existing_sections = list(lesson_copy.sections.all().order_by("order", "id"))
        user_section_predecessor: Dict[Any, Optional[Any]] = {}
        prev_s = None
        for s in existing_sections:
            if not s.original_section_id:
                user_section_predecessor[s.id] = prev_s.id if prev_s else None
            prev_s = s

        new_sections: List[Section] = []
        if orig_lesson:
            for orig_section in orig_lesson.sections.all().order_by("order"):
                section_copy = next((x for x in existing_sections if x.original_section_id == orig_section.id), None)
                if section_copy:
                    if not keep_user_content:
                        section_copy.title = orig_section.title
                    section_copy.save(update_fields=["title"])
                else:
                    section_copy = Section.objects.create(
                        lesson=lesson_copy,
                        original_section=orig_section,
                        title=orig_section.title,
                        order=0,
                    )
                new_sections.append(section_copy)

        remaining_user_sections = [s for s in existing_sections if not s.original_section_id]
        for user_section in remaining_user_sections:
            pred_id = user_section_predecessor.get(user_section.id)
            if pred_id is None:
                new_sections.insert(0, user_section)
            else:
                idx = next((i for i, it in enumerate(new_sections) if it.id == pred_id), None)
                if idx is None:
                    new_sections.append(user_section)
                else:
                    new_sections.insert(idx + 1, user_section)

        # Синхронизация заданий внутри секции
        for section_copy in new_sections:
            orig_section = section_copy.original_section

            # удалить задачи-копии оригиналов, которых больше нет в оригинале
            if orig_section:
                orig_task_ids = {t.id for t in orig_section.tasks.all()}
                for t in list(section_copy.tasks.filter(original_task__isnull=False)):
                    if t.original_task_id not in orig_task_ids:
                        t.delete()

            if not keep_user_content:
                # удалить пользовательские задачи (original_task is null)
                section_copy.tasks.filter(original_task__isnull=True).delete()
                # сбросить edited_content у оставшихся копий (original_task != null)
                for t in section_copy.tasks.filter(original_task__isnull=False):
                    if t.edited_content != {}:
                        t.edited_content = {}
                        t.save(update_fields=["edited_content"])

            # собираем текущие задачи: сначала пользовательские (original_task is null), затем копии
            user_tasks = list(section_copy.tasks.filter(original_task__isnull=True))
            copy_tasks = list(section_copy.tasks.filter(original_task__isnull=False))

            def _sort_key(obj):
                return (getattr(obj, "order", 0), getattr(obj, "id", None))

            user_tasks.sort(key=_sort_key)
            copy_tasks.sort(key=_sort_key)

            # группируем пользовательские элементы по предшественнику оригинала
            tasks_objs = user_tasks + copy_tasks
            groups: Dict[Optional[Any], List[Any]] = defaultdict(list)
            last_orig_id: Optional[Any] = None
            for item in tasks_objs:
                if getattr(item, "original_task_id", None):
                    last_orig_id = item.original_task_id
                else:
                    groups[last_orig_id].append(item)

            new_tasks_order: List[Any] = []
            if groups.get(None):
                new_tasks_order.extend(groups[None])

            if orig_section:
                for orig_task in orig_section.tasks.all().order_by("order"):
                    task_copy = section_copy.tasks.filter(original_task=orig_task).first()
                    if not task_copy:
                        task_copy = Task.objects.create(
                            section=section_copy,
                            original_task=orig_task,
                            task_type=orig_task.task_type,
                            content_type=orig_task.content_type,
                            object_id=orig_task.object_id,
                            edited_content={},
                            order=0,
                        )
                    else:
                        if not keep_user_content and task_copy.edited_content != {}:
                            task_copy.edited_content = {}
                            task_copy.save(update_fields=["edited_content"])
                    new_tasks_order.append(task_copy)

                    if groups.get(orig_task.id):
                        new_tasks_order.extend(groups[orig_task.id])
            else:
                for k, lst in groups.items():
                    if k is not None:
                        new_tasks_order.extend(lst)

            for idx, item in enumerate(new_tasks_order, start=1):
                if getattr(item, "order", None) != idx:
                    item.order = idx
                    item.save(update_fields=["order"])

        for idx, section in enumerate(new_sections, start=1):
            if section.order != idx:
                section.order = idx
                section.save(update_fields=["order"])

    for idx, lesson in enumerate(new_lessons, start=1):
        if lesson.order != idx:
            lesson.order = idx
            lesson.save(update_fields=["order"])


def normalize_order(course_copy: Course) -> None:
    """
    Приводит order уроков, секций и задач к непрерывной последовательности.
    Пользовательские задачи (original_task IS NULL) идут первыми, затем копии.
    """
    for l_idx, lesson in enumerate(course_copy.lessons.all().order_by("order", "id"), start=1):
        if lesson.order != l_idx:
            lesson.order = l_idx
            lesson.save(update_fields=["order"])

        for s_idx, section in enumerate(lesson.sections.all().order_by("order", "id"), start=1):
            if section.order != s_idx:
                section.order = s_idx
                section.save(update_fields=["order"])

            user_tasks = list(section.tasks.filter(original_task__isnull=True).order_by("order", "id"))
            copy_tasks = list(section.tasks.filter(original_task__isnull=False).order_by("order", "id"))
            combined = user_tasks + copy_tasks
            for t_idx, t in enumerate(combined, start=1):
                if t.order != t_idx:
                    t.order = t_idx
                    t.save(update_fields=["order"])
