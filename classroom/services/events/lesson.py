from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction


def notify_lesson_attached(*, classroom_id: str, lesson_id: int) -> None:
    """
    Отправляет websocket-уведомление всем участникам виртуального класса
    о смене / прикреплении урока.

    Вызывается строго после commit транзакции.
    """
    channel_layer = get_channel_layer()

    async_to_sync(channel_layer.group_send)(
        f"classroom_{classroom_id}",
        {
            "type": "lesson_attached",
            "lesson_id": lesson_id,
        },
    )


def attach_lesson_and_notify(*, classroom, lesson) -> None:
    """
    Привязывает урок к классу и отправляет websocket-уведомление.
    """
    with transaction.atomic():
        classroom.attach_lesson(lesson)

        transaction.on_commit(
            lambda: notify_lesson_attached(
                classroom_id=str(classroom.id),
                lesson_id=lesson.id,
            )
        )
