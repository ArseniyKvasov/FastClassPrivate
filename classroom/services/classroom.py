from classroom.models import Classroom
from courses.models import Course, Lesson
from courses.services import create_course_copy_for_user, CourseUnavailableError, CourseNeedsUpdate


def attach_lesson_to_classroom(classroom: Classroom, lesson: Lesson, user) -> None:
    """
    Прикрепляет урок к классу с учётом версий курсов.

    Исключения:
    - CourseUnavailableError — публичный курс неактивен
    - CourseNeedsUpdate — у пользователя есть курс в той же ветке версий
    - ValueError — логическая ошибка
    """
    course = lesson.course

    if course.is_public:
        user_course = create_course_copy_for_user(
            course,
            user,
            keep_user_content=False
        )

        user_lesson = user_course.lessons.filter(
            original_lesson=lesson
        ).first()

        if not user_lesson:
            raise ValueError(
                "В копии курса не найден урок, соответствующий оригиналу"
            )
    else:
        user_course = Course.objects.filter(
            creator=user,
            lessons=lesson
        ).first()

        if not user_course:
            raise ValueError("Урок не принадлежит курсу пользователя")

        user_lesson = lesson

    classroom.lesson = user_lesson
    classroom.save(update_fields=["lesson"])


def set_copying(classroom, user, enabled):
    if user != classroom.teacher:
        return False, "Недостаточно прав"
    classroom.copying_enabled = enabled
    classroom.save(update_fields=["copying_enabled"])
    return True, classroom.copying_enabled
