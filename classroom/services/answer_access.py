def check_user_access(request_user, classroom, target_user):
    """
    Проверяет, имеет ли request_user право работать с ответами target_user
    в рамках classroom.
    """
    if not request_user.is_authenticated or not target_user.is_authenticated:
        return False

    available_users = classroom.get_available_users(request_user)

    return (
        request_user in available_users
        and target_user in available_users
    )