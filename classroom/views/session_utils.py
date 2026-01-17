from datetime import timedelta, datetime
from django.utils import timezone

SESSION_VERIFIED_KEY = "classroom_{}_password_verified"
SESSION_VERIFIED_TS_KEY = "classroom_{}_password_verified_ts"
SESSION_TTL = timedelta(minutes=1)


def _now_ts() -> int:
    return int(timezone.now().timestamp())


def set_verified_in_session(request, classroom, password: str) -> None:
    key = SESSION_VERIFIED_KEY.format(classroom.id)
    ts_key = SESSION_VERIFIED_TS_KEY.format(classroom.id)

    request.session.pop(key, None)
    request.session.pop(ts_key, None)

    request.session[key] = password
    request.session[ts_key] = _now_ts()
    request.session.modified = True


def clear_verified_in_session(request, classroom) -> None:
    key = SESSION_VERIFIED_KEY.format(classroom.id)
    ts_key = SESSION_VERIFIED_TS_KEY.format(classroom.id)
    request.session.pop(key, None)
    request.session.pop(ts_key, None)
    request.session.modified = True


def is_session_verified(request, classroom) -> bool:
    """
    Проверяет, валиден ли пароль класса в сессии.
    Если в сессии найдено устаревшее/неправильное значение типа datetime,
    оно конвертируется в unix-ts, чтобы не ломать сериализацию.
    """
    key = SESSION_VERIFIED_KEY.format(classroom.id)
    ts_key = SESSION_VERIFIED_TS_KEY.format(classroom.id)

    password = request.session.get(key)
    ts = request.session.get(ts_key)

    if not password or ts is None:
        return False

    try:
        if isinstance(ts, datetime):
            ts_int = int(ts.timestamp())
            request.session[ts_key] = ts_int
            request.session.modified = True
        else:
            ts_int = int(ts)
    except Exception:
        clear_verified_in_session(request, classroom)
        return False

    now_ts = _now_ts()
    if now_ts - ts_int > int(SESSION_TTL.total_seconds()):
        clear_verified_in_session(request, classroom)
        return False

    return password == classroom.join_password
