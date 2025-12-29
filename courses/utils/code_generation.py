import random
import string


def generate_course_id():
    """Генерирует уникальный 8-символьный id для курса"""
    from courses.models import Course
    chars = string.ascii_letters + string.digits
    attempts = 0
    while attempts < 5:
        attempts += 1
        new_id = ''.join(random.choices(chars, k=8))
        if not Course.objects.filter(id=new_id).exists():
            return new_id
