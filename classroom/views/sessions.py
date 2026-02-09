from datetime import timedelta, datetime
from django.utils import timezone

SESSION_VERIFIED_KEY = "classroom_{}_verified"
SESSION_VERIFIED_TS_KEY = "classroom_{}_verified_ts"
SESSION_TTL = timedelta(minutes=1)

def _now_ts() -> int:
    return int(timezone.now().timestamp())

def set_verified_in_session(request, classroom) -> None:
    key = SESSION_VERIFIED_KEY.format(classroom.id)
    ts_key = SESSION_VERIFIED_TS_KEY.format(classroom.id)
    request.session[key] = True
    request.session[ts_key] = _now_ts()
    request.session.modified = True

def clear_verified_in_session(request, classroom) -> None:
    key = SESSION_VERIFIED_KEY.format(classroom.id)
    ts_key = SESSION_VERIFIED_TS_KEY.format(classroom.id)
    request.session.pop(key, None)
    request.session.pop(ts_key, None)
    request.session.modified = True

def is_session_verified(request, classroom) -> bool:
    key = SESSION_VERIFIED_KEY.format(classroom.id)
    ts_key = SESSION_VERIFIED_TS_KEY.format(classroom.id)
    verified = request.session.get(key)
    ts = request.session.get(ts_key)
    if not verified or ts is None:
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
    if _now_ts() - ts_int > int(SESSION_TTL.total_seconds()):
        clear_verified_in_session(request, classroom)
        return False
    return True
