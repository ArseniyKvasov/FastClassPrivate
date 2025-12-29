import random
import string
import uuid


def generate_short_uuid():
    """Генерирует уникальный 8-символьный id для класса"""
    from classroom.models import Classroom
    attempts = 0
    while attempts < 5:
        attempts += 1
        new_id = uuid.uuid4().hex[:8]
        if not Classroom.objects.filter(id=new_id).exists():
            return new_id


def generate_invite_code():
    """Генерирует уникальный 6-символьный пригласительный код"""
    from classroom.models import Classroom
    chars = string.ascii_uppercase + string.digits
    attempts = 0
    while attempts < 5:
        attempts += 1
        new_code = ''.join(random.choices(chars, k=6))
        if not Classroom.objects.filter(invite_code=new_code).exists():
            return new_code
