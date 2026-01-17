def get_display_name_from_username(username: str) -> str:
    """
    Из username формата classroom_<id>_<first_name>_<last_name>
    возвращает красивое имя с заглавной первой буквой и сокращенной фамилией:
    'Иван И.'
    """
    try:
        parts = username.split("_")
        if len(parts) < 4:
            return username

        first_name = parts[2].capitalize()
        last_name = parts[3]
        last_initial = last_name[0].upper() if last_name else ""
        return f"{first_name} {last_initial}."
    except Exception:
        return username