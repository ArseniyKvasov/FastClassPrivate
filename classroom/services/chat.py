from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404

from classroom.models import ChatMessage, Classroom

def send_chat_message(*, sender, classroom_id, text):
    """
    Создаёт сообщение в общем чате класса.
    После создания ограничивает количество сообщений до 50.
    """
    classroom = get_object_or_404(Classroom, id=classroom_id)

    if not text or not text.strip():
        raise ValueError("Message text is empty")

    message = ChatMessage.objects.create(
        classroom=classroom,
        sender=sender,
        text=text.strip()
    )

    _cleanup_old_messages(classroom)

    return message

def get_last_chat_messages(*, classroom_id, limit=50):
    """
    Возвращает последние сообщения чата класса.
    """
    classroom = get_object_or_404(Classroom, id=classroom_id)

    return list(
        ChatMessage.objects
        .filter(classroom=classroom)
        .order_by("-created_at")[:limit]
    )

def edit_chat_message(*, user, message_id, new_text):
    """
    Редактирует сообщение.
    Редактировать может только автор сообщения.
    """
    message = get_object_or_404(ChatMessage, id=message_id)

    if message.sender_id != user.id:
        raise PermissionDenied("Cannot edit чужое сообщение")

    if not new_text or not new_text.strip():
        raise ValueError("Message text is empty")

    message.text = new_text.strip()
    message.save(update_fields=["text"])

    return message

def delete_chat_message(*, user, message_id):
    """
    Удаляет сообщение.
    Удалять может автор сообщения или учитель класса.
    """
    message = get_object_or_404(ChatMessage, id=message_id)

    is_owner = message.sender_id == user.id
    is_teacher = message.classroom.teacher_id == user.id

    if not is_owner and not is_teacher:
        raise PermissionDenied("Cannot delete сообщение")

    message.delete()

def _cleanup_old_messages(classroom, limit=50):
    """
    Удаляет старые сообщения, если их больше limit.
    """
    ids = (
        ChatMessage.objects
        .filter(classroom=classroom)
        .order_by("-created_at")
        .values_list("id", flat=True)[limit:]
    )

    if ids:
        ChatMessage.objects.filter(id__in=list(ids)).delete()
