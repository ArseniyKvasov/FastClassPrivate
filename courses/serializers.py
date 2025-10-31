import bleach
from rest_framework import serializers
from .models import *
import re

# ---------------------------
# TestTask
# ---------------------------
class TestTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestTask
        fields = ["question", "options"]

    def validate_options(self, value):
        # Убираем пустые варианты
        value = [o for o in value if o.get("option", "").strip()]
        if not value:
            raise serializers.ValidationError("Нужно хотя бы один вариант ответа")
        return value

    def validate(self, data):
        # Проверяем что есть вопрос
        question = data.get("question", "").strip()
        if not question:
            raise serializers.ValidationError({"question": "Вопрос не может быть пустым"})
        return data


# ---------------------------
# TrueFalseTask
# ---------------------------
class TrueFalseTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrueFalseTask
        fields = ["statement", "is_true"]

    def validate_statement(self, value):
        if not value.strip():
            raise serializers.ValidationError("Утверждение не может быть пустым")
        return value


# ---------------------------
# FillGapsTask
# ---------------------------
class FillGapsTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = FillGapsTask
        fields = ["text", "answers", "task_type"]

    def validate(self, data):
        text = data.get("text", "").strip()
        answers = data.get("answers", [])

        if not text:
            raise serializers.ValidationError({"text": "Текст не может быть пустым"})

        if not answers:
            raise serializers.ValidationError({"answers": "Нужно хотя бы один правильный ответ"})

        # Кол-во [] в тексте должно соответствовать числу ответов
        blanks_count = len(re.findall(r"\[(.*?)\]", text))
        if blanks_count != len(answers):
            raise serializers.ValidationError({
                "answers": f"Количество пропусков {blanks_count} не соответствует числу ответов {len(answers)}"
            })

        return data


# ---------------------------
# MatchCardsTask
# ---------------------------
class MatchCardsTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = MatchCardsTask
        fields = ["cards"]

    def validate_cards(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Карточки должны быть списком")

        normalized = []
        for item in value:
            left = item.get("card_left", "").strip()
            right = item.get("card_right", "").strip()
            if left and right:
                normalized.append({"card_left": left, "card_right": right})

        if not normalized:
            raise serializers.ValidationError("Нужно хотя бы одну заполненную пару")

        return normalized


# ---------------------------
# NoteTask
# ---------------------------
SAFE_TAGS = ["b", "i", "u", "ul", "ol", "li"]

class NoteTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteTask
        fields = ["content"]

    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError("Содержимое заметки не может быть пустым")

        cleaned_value = bleach.clean(
            value,
            tags=SAFE_TAGS,
            strip=True
        )
        return cleaned_value


# ---------------------------
# ImageTask
# ---------------------------
class ImageTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImageTask
        fields = ["image", "caption"]

    def validate_image(self, value):
        if not value:
            raise serializers.ValidationError("Изображение обязательно")
        if not value.name.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")):
            raise serializers.ValidationError("Допустимые форматы: PNG, JPG, JPEG, GIF, WEBP")
        return value


# ---------------------------
# TextInputTask
# ---------------------------
class TextInputTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = TextInputTask
        fields = ["prompt", "default_text"]

    def validate_prompt(self, value):
        if not value.strip():
            raise serializers.ValidationError("Текст задания не может быть пустым")
        return value


# ---------------------------
# Карта сериализаторов
# ---------------------------
TASK_SERIALIZER_MAP = {
    "test": TestTaskSerializer,
    "note": NoteTaskSerializer,
    "image": ImageTaskSerializer,
    "true_false": TrueFalseTaskSerializer,
    "fill_gaps": FillGapsTaskSerializer,
    "match_cards": MatchCardsTaskSerializer,
    "text_input": TextInputTaskSerializer,
}
