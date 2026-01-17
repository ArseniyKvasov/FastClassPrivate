def set_copying(classroom, user, enabled):
    if user != classroom.teacher:
        return False, "Недостаточно прав"
    classroom.copying_enabled = enabled
    classroom.save(update_fields=["copying_enabled"])
    return True, classroom.copying_enabled
