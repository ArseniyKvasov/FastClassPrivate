def normalize_str(s):
    """Нормализация строки для сравнения"""
    if s is None:
        return ""
    return str(s).strip().lower()