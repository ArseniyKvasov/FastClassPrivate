from rest_framework import serializers
from courses.models import WordListTask


class WordListTaskSerializer(serializers.ModelSerializer):
    """
    Сериализатор для задач со списком слов.
    """
    class Meta:
        model = WordListTask
        fields = ["words"]

    def validate_words(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Слова должны быть списком")

        normalized = []
        for item in value:
            word = str(item.get("word", "")).strip()
            translation = str(item.get("translation", "")).strip()
            if word and translation:
                normalized.append({
                    "word": word,
                    "translation": translation
                })

        if len(normalized) < 1:
            raise serializers.ValidationError("Добавьте как минимум одно слово с переводом")

        return normalized

