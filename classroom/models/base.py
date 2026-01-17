from django.db import models
from django.conf import settings

User = settings.AUTH_USER_MODEL


class BaseAnswer(models.Model):
    id = models.BigAutoField(primary_key=True)
    task = models.ForeignKey("courses.Task", on_delete=models.CASCADE, db_index=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_index=True)
    classroom = models.ForeignKey("classroom.Classroom", on_delete=models.CASCADE)
    answered_at = models.DateTimeField(auto_now_add=True)

    correct_answers = models.PositiveIntegerField(default=0)
    wrong_answers = models.PositiveIntegerField(default=0)
    total_answers = models.PositiveIntegerField(default=0)

    class Meta:
        abstract = True

    def save_answer_data(self, data):
        raise NotImplementedError("Subclasses must implement save_answer_data")

    def get_answer_data(self):
        raise NotImplementedError("Subclasses must implement get_answer_data")

    def increment_correct_answers(self):
        self.correct_answers += 1
        self.save(update_fields=['correct_answers'])

    def increment_wrong_answers(self):
        self.wrong_answers += 1
        self.save(update_fields=['wrong_answers'])

    def get_success_percentage(self):
        total_attempts = self.correct_answers + self.wrong_answers
        if total_attempts == 0:
            return 0
        return round((self.correct_answers / total_attempts) * 100)

    def get_task_total_answers(self):
        try:
            specific_task = self.task.specific
            if hasattr(specific_task, 'total_answers'):
                return specific_task.total_answers
        except Exception:
            pass
        return 0

    def delete_answers(self):
        self.correct_answers = 0
        self.wrong_answers = 0
        self.save(update_fields=['correct_answers', 'wrong_answers'])


class ChatMessage(models.Model):
    """
    Сообщение общего чата внутри класса.
    Чат один на classroom, без личных сообщений.
    """
    id = models.BigAutoField(primary_key=True)

    classroom = models.ForeignKey(
        "classroom.Classroom",
        on_delete=models.CASCADE,
        related_name="chat_messages"
    )

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chat_messages"
    )

    text = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["classroom", "created_at"]),
        ]

    def __str__(self):
        return f"[{self.classroom_id}] {self.sender_id}: {self.text[:30]}"
