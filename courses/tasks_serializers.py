import bleach
from django.utils.html import strip_tags
from rest_framework import serializers
from .models import *
import re

SAFE_TAGS = [
    "b", "i", "u", "em", "strong",
    "ul", "ol", "li",
    "p", "br",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "div", "span",
    "blockquote", "code", "pre",
    "table", "thead", "tbody", "tr", "th", "td",
    "a", "img"
]

SAFE_ATTRIBUTES = {
    "a": ["href", "title", "target"],
    "img": ["src", "alt", "title", "width", "height"],
    "*": ["class", "style", "id"]
}


class TestTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestTask
        fields = ["questions"]

    def validate_questions(self, value):
        print(value)
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("Нужно хотя бы один вопрос")

        for q in value:
            question = q.get("question", "").strip()
            if not question:
                raise serializers.ValidationError("Вопрос не может быть пустым")

            options = [o for o in q.get("options", []) if o.get("option", "").strip()]
            if not options:
                raise serializers.ValidationError("Нужно хотя бы один вариант ответа")
            if not any(o.get("is_correct") for o in options):
                raise serializers.ValidationError("Хотя бы один вариант должен быть правильным")

            q["options"] = options
            q["question"] = question

        return value


class TrueFalseTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrueFalseTask
        fields = ["statements"]

    def validate_statements(self, value):
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("Нужно хотя бы одно утверждение")

        for stmt in value:
            text = stmt.get("statement", "").strip()
            if not text:
                raise serializers.ValidationError("Утверждение не может быть пустым")
            stmt["statement"] = text
            stmt["is_true"] = bool(stmt.get("is_true", False))

        return value


class FillGapsTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = FillGapsTask
        fields = ["text", "answers", "task_type"]

    def validate(self, data):
        text = data.get("text", "").strip()
        answers = data.get("answers", [])
        task_type = data.get("task_type", "open")

        if not text:
            raise serializers.ValidationError({"text": "Текст не может быть пустым"})

        if task_type == "open":
            blanks_count = len(re.findall(r"\[(.*?)\]", text))
            if blanks_count == 0:
                raise serializers.ValidationError({
                    "text": "Текст должен содержать пропуски в формате [текст]"
                })
        else:
            if not answers:
                raise serializers.ValidationError({"answers": "Нужно хотя бы один правильный ответ"})

            blanks_count = len(re.findall(r"\[(.*?)\]", text))
            if blanks_count != len(answers):
                raise serializers.ValidationError({
                    "answers": f"Количество пропусков {blanks_count} не соответствует числу ответов {len(answers)}"
                })

        return data


class MatchCardsTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = MatchCardsTask
        fields = ["cards"]

    def _sanitize_text(self, text: str) -> str:
        """
        Полная очистка текста для безопасного отображения без JS escape.
        1. Удаляет HTML-теги (<script>, <div>, ...)
        2. Убирает JS-опасные символы
        3. Чистит невидимые Unicode-символы, ломающие JS
        """
        text = strip_tags(text)

        dangerous = r"[<>/{}[\]();]"
        text = re.sub(dangerous, "", text)

        text = text.replace("\u2028", "").replace("\u2029", "")

        return text.strip()

    def validate_cards(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Карточки должны быть списком")

        normalized = []
        for item in value:
            left = self._sanitize_text(item.get("card_left", ""))
            right = self._sanitize_text(item.get("card_right", ""))

            if left and right:
                normalized.append({
                    "card_left": left,
                    "card_right": right
                })

        if not normalized:
            raise serializers.ValidationError("Нужно хотя бы одну заполненную пару")

        return normalized


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
            attributes=SAFE_ATTRIBUTES,
            strip=True
        )
        return cleaned_value


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


class TextInputTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = TextInputTask
        fields = ["prompt", "default_text"]

    def validate_prompt(self, value):
        if not value.strip():
            raise serializers.ValidationError("Текст задания не может быть пустым")
        return value


TASK_SERIALIZER_MAP = {
    "test": TestTaskSerializer,
    "note": NoteTaskSerializer,
    "image": ImageTaskSerializer,
    "true_false": TrueFalseTaskSerializer,
    "fill_gaps": FillGapsTaskSerializer,
    "match_cards": MatchCardsTaskSerializer,
    "text_input": TextInputTaskSerializer,
}
