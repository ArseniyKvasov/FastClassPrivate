from django.db import models

class WordListTask(models.Model):
    words = models.JSONField(default=list)
    total_words = models.PositiveIntegerField(default=0)

    def save(self, *args, **kwargs):
        source = self.words or []

        self.total_words = len(source) if source else 0

        super().save(*args, **kwargs)