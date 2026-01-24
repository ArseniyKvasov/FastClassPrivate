from classroom.models import Classroom
from courses.models import Course, Lesson
from courses.services import create_course_copy_for_user


def attach_lesson_to_classroom(classroom: Classroom, lesson: Lesson, user):
    """
    Проверяет, есть ли у пользователя курс с нужным уроком.
    Если нет — создаёт копию курса и прикрепляет урок.
    Возвращает info о прикреплённом уроке (id, is_copy)
    """
    user_course = Course.objects.filter(creator=user, lessons=lesson).first()
    if not user_course:
        user_course = create_course_copy_for_user(lesson.course, user, keep_user_content=False)

    user_lesson = user_course.lessons.filter(title=lesson.title).first()
    if not user_lesson:
        raise ValueError("Не удалось получить урок после копирования курса")

    classroom.lesson = user_lesson
    classroom.save(update_fields=["lesson"])

    return user_lesson


def set_copying(classroom, user, enabled):
    if user != classroom.teacher:
        return False, "Недостаточно прав"
    classroom.copying_enabled = enabled
    classroom.save(update_fields=["copying_enabled"])
    return True, classroom.copying_enabled
