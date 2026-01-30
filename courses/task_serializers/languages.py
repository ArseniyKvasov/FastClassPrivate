import re
from django.utils.html import strip_tags
from rest_framework import serializers
from courses.models import (
    WordListTask
)


class WordListTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = WordListTask
        fields = ["words"]

    def _sanitize_text(self, text: str) -> str:
        """
        Очищает текст от HTML, опасных символов и служебных Unicode-разделителей.
        """
        text = strip_tags(text)
        text = re.sub(r"[<>/{}[\]();]", "", text)
        text = text.replace("\u2028", "").replace("\u2029", "")
        return text.strip()

    def validate_words(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Список слов должен быть массивом")

        normalized = []
        word_set = set()
        translation_set = set()

        for item in value:
            word = self._sanitize_text(item.get("word", ""))
            translation = self._sanitize_text(item.get("translation", ""))

            if word and translation:
                if word in word_set:
                    raise serializers.ValidationError("Найдены одинаковые слова")
                if translation in translation_set:
                    raise serializers.ValidationError("Найдены одинаковые переводы")

                word_set.add(word)
                translation_set.add(translation)
                normalized.append({
                    "word": word,
                    "translation": translation
                })

        if len(normalized) < 2:
            raise serializers.ValidationError(
                "Добавьте как минимум два слова с переводом"
            )

        return normalized
