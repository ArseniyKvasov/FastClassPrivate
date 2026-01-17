# classroom/services.py
import re
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from django.utils.crypto import constant_time_compare

User = get_user_model()

_name_part_pattern = re.compile(r"^[A-Za-zА-Яа-яЁё\-/]+$")


def _normalize_part(part: str) -> str:
    part = part.strip()
    def title_sub(s: str) -> str:
        if not s:
            return s
        return s[0].upper() + s[1:].lower()
    for sep in ("-", "/"):
        if sep in part:
            return sep.join(title_sub(p) for p in part.split(sep))
    return title_sub(part)


def validate_name_parts(first_name: str, last_name: str):
    if not first_name or not last_name:
        raise ValidationError("Имя и фамилия обязательны.")
    if len(first_name) > 18 or len(last_name) > 18:
        raise ValidationError("Максимальная длина имени или фамилии — 18 символов.")
    if not _name_part_pattern.fullmatch(first_name):
        raise ValidationError("Имя содержит недопустимые символы.")
    if not _name_part_pattern.fullmatch(last_name):
        raise ValidationError("Фамилия содержит недопустимые символы.")


def build_usernames(classroom_id: int, first_name: str, last_name: str) -> tuple[str, str]:
    fn = _normalize_part(first_name)
    ln = _normalize_part(last_name)
    display_name = f"{fn} {ln}"
    username = f"classroom_{classroom_id}_{fn}_{ln}".replace(" ", "_").lower()
    return display_name, username


def create_or_get_user(username: str, display_name: str) -> tuple[User, bool]:
    first, last = (display_name.split(" ", 1) + [""])[:2]
    user, created = User.objects.get_or_create(username=username)
    if created:
        user.first_name = first
        user.last_name = last
        user.save(update_fields=["first_name", "last_name"])
    return user, created


def attach_user_to_classroom(classroom, user, password: str):
    return classroom.join(user, password)


def finalize_join(classroom, first_name: str, last_name: str) -> tuple[User, bool, str]:
    """
    Создаёт или получает пользователя и прикрепляет его к классу.
    Если пользователь уже в классе — просто возвращает его.
    Возвращает кортеж: (user, создан ли новый, ошибка)
    """
    try:
        validate_name_parts(first_name, last_name)
        display_name, username = build_usernames(classroom.id, first_name, last_name)
        user, created = create_or_get_user(username, display_name)

        if user not in classroom.students.all():
            attach_user_to_classroom(classroom, user, classroom.join_password)

        return user, created, ""
    except ValidationError as e:
        return user if 'user' in locals() else None, False, str(e)


def verify_classroom_password(classroom, password):
    if not classroom.join_password:
        return True
    return constant_time_compare(password, classroom.join_password)
