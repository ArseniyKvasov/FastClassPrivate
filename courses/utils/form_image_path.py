import uuid
from django.utils.timezone import now


def task_image_upload_to(instance, filename):
    """
    Генерируем уникальное имя файла.
    Формат: tasks/images/<UUID>_<timestamp>.<ext>
    """
    ext = filename.split('.')[-1]
    unique_id = uuid.uuid4().hex
    timestamp = now().strftime("%Y%m%d%H%M%S")
    return f"tasks/images/{unique_id}_{timestamp}.{ext}"