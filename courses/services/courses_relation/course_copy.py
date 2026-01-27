from typing import List, Dict, Optional

from django.db import transaction
from django.core.exceptions import ValidationError

from courses.models import Course, Lesson, Section, Task


class CourseUnavailableError(Exception):
    """Курс временно недоступен (is_active=False)."""


class CourseNeedsUpdate(Exception):
    """
    У пользователя уже есть копия курса в той же ветке версий.

    user_course_id — id курса пользователя, который требуется обновить
    """

    def __init__(self, user_course_id: int, message: str = "Нуждается в обновлении"):
        super().__init__(message)
        self.user_course_id = user_course_id


def _get_active_course_version(course: Course) -> Course:
    """
    Возвращает активную публичную версию курса по цепочке new_version.
    """
    current = course
    visited = set()

    while not (current.is_active and current.is_public):
        if not current.new_version:
            raise ValidationError(
                f"Курс {course.id} не имеет активной публичной версии"
            )

        if current.id in visited:
            raise ValidationError(
                f"Циклическая зависимость версий курса {course.id}"
            )

        visited.add(current.id)
        current = current.new_version

        if len(visited) > 100:
            raise ValidationError(
                f"Слишком длинная цепочка версий курса {course.id}"
            )

    return current


@transaction.atomic
def create_course_copy_for_user(
    course: Course,
    user,
    keep_user_content: bool = True
) -> Course:
    """
    Возвращает курс пользователя для переданного курса.
    """
    if course.is_public and not course.is_active:
        raise CourseUnavailableError("Курс временно недоступен")

    active_course = _get_active_course_version(course)

    existing_copy = Course.objects.filter(
        creator=user,
        original_course=active_course
    ).first()

    if existing_copy:
        return existing_copy

    target_latest = (
        course.get_latest_version()
        if hasattr(course, "get_latest_version")
        else course
    )

    user_copies = Course.objects.filter(
        creator=user,
        original_course__isnull=False
    )

    for uc in user_copies:
        try:
            uc_latest = uc.original_course.get_latest_version()
        except Exception:
            uc_latest = uc.original_course

        if uc_latest and target_latest and uc_latest.id == target_latest.id:
            raise CourseNeedsUpdate(user_course_id=uc.id)

    course_copy = Course.objects.create(
        creator=user,
        original_course=active_course,
        title=active_course.title,
        description=active_course.description,
        version=active_course.version,
        subject=active_course.subject,
        is_public=False,
    )

    _populate_course_copy(active_course, course_copy)
    normalize_order(course_copy)

    return course_copy


def _populate_course_copy(original_course: Course, course_copy: Course) -> None:
    """
    Первичное копирование структуры курса.
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
def sync_course_copy_with_user(
    course_copy: Course,
    original_course: Course,
    keep_user_content: bool = True
) -> None:
    """
    Синхронизирует копию курса с оригиналом.
    """
    course_copy.title = original_course.title
    course_copy.description = original_course.description
    course_copy.version = original_course.version
    course_copy.subject = original_course.subject
    course_copy.save(update_fields=["title", "description", "version", "subject"])

    orig_lesson_ids = {l.id for l in original_course.lessons.all()}
    for lesson in list(course_copy.lessons.all()):
        if lesson.original_lesson_id and lesson.original_lesson_id not in orig_lesson_ids:
            lesson.delete()

    if not keep_user_content:
        course_copy.lessons.filter(original_lesson__isnull=True).delete()

    existing_lessons = list(course_copy.lessons.all().order_by("order", "id"))
    user_predecessor: Dict[int, Optional[int]] = {}
    prev = None

    for lesson in existing_lessons:
        if not lesson.original_lesson_id:
            user_predecessor[lesson.id] = prev.id if prev else None
        prev = lesson

    new_lessons: List[Lesson] = []
    for orig in original_course.lessons.all().order_by("order"):
        lesson_copy = next(
            (l for l in existing_lessons if l.original_lesson_id == orig.id),
            None
        )
        if not lesson_copy:
            lesson_copy = Lesson.objects.create(
                course=course_copy,
                original_lesson=orig,
                title=orig.title,
                order=0,
            )
        elif not keep_user_content:
            lesson_copy.title = orig.title
            lesson_copy.save(update_fields=["title"])

        new_lessons.append(lesson_copy)

    for user_lesson in [l for l in existing_lessons if not l.original_lesson_id]:
        pred_id = user_predecessor.get(user_lesson.id)
        if pred_id is None:
            new_lessons.insert(0, user_lesson)
        else:
            idx = next(
                (i for i, it in enumerate(new_lessons) if it.id == pred_id),
                None
            )
            if idx is None:
                new_lessons.append(user_lesson)
            else:
                new_lessons.insert(idx + 1, user_lesson)

    for idx, lesson in enumerate(new_lessons, start=1):
        if lesson.order != idx:
            lesson.order = idx
            lesson.save(update_fields=["order"])

    if not keep_user_content:
        Task.objects.filter(
            section__lesson__course=course_copy,
            original_task__isnull=False
        ).update(edited_content={})

    normalize_order(course_copy)


def normalize_order(course_copy: Course) -> None:
    """
    Нормализует order уроков, секций и задач.
    """
    for l_idx, lesson in enumerate(
        course_copy.lessons.all().order_by("order", "id"),
        start=1
    ):
        if lesson.order != l_idx:
            lesson.order = l_idx
            lesson.save(update_fields=["order"])

        for s_idx, section in enumerate(
            lesson.sections.all().order_by("order", "id"),
            start=1
        ):
            if section.order != s_idx:
                section.order = s_idx
                section.save(update_fields=["order"])

            user_tasks = list(
                section.tasks
                .filter(original_task__isnull=True)
                .order_by("order", "id")
            )
            copy_tasks = list(
                section.tasks
                .filter(original_task__isnull=False)
                .order_by("order", "id")
            )

            for t_idx, task in enumerate(user_tasks + copy_tasks, start=1):
                if task.order != t_idx:
                    task.order = t_idx
                    task.save(update_fields=["order"])
