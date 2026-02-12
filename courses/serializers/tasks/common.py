import re
import bleach
from bleach.css_sanitizer import CSSSanitizer
from django.utils.html import strip_tags
from rest_framework import serializers
from urllib.parse import urlparse
from courses.models import (
    TestTask, TrueFalseTask, FillGapsTask, MatchCardsTask,
    NoteTask, TextInputTask, IntegrationTask, FileTask,
    WordListTask
)


ALLOWED_TAGS = ["strong", "b", "i", "u", "ul", "ol", "li", "div", "p", "br", "span", "sup"]

ALLOWED_ATTRIBUTES = {}
ALLOWED_STYLES = []


def clean_text_style(html: str) -> str:
    """Очищает HTML, оставляя только разрешенные теги без атрибутов и стилей"""
    if not isinstance(html, str):
        return ""

    cleaned_html = bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        strip=True
    )

    return cleaned_html


class TestTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestTask
        fields = ["questions"]

    def validate_questions(self, value):
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("Должен быть хотя бы один вопрос")
        if len(value) < 1:
            raise serializers.ValidationError("Должен быть хотя бы один вопрос")

        for i, q in enumerate(value):
            if not isinstance(q, dict):
                raise serializers.ValidationError(f"Вопрос {i + 1} должен быть словарем")

            question_text = q.get("question", "")
            if not isinstance(question_text, str):
                raise serializers.ValidationError(f"Текст вопроса {i + 1} должен быть строкой")

            q["question"] = clean_text_style(question_text.strip())
            if not q["question"]:
                raise serializers.ValidationError(f"Вопрос {i + 1} не может быть пустым")

            options = q.get("options", [])
            if not isinstance(options, list):
                raise serializers.ValidationError(f"Варианты ответа для вопроса {i + 1} должны быть списком")
            if len(options) < 2:
                raise serializers.ValidationError(f"В вопросе {i + 1} должно быть как минимум 2 варианта ответа")

            valid_options = []
            has_correct = False

            for j, opt in enumerate(options):
                if not isinstance(opt, dict):
                    raise serializers.ValidationError(f"Вариант {j + 1} в вопросе {i + 1} должен быть словарем")

                option_text = opt.get("option", "")
                if not isinstance(option_text, str):
                    raise serializers.ValidationError(f"Текст варианта {j + 1} в вопросе {i + 1} должен быть строкой")

                cleaned_option = clean_text_style(option_text.strip())
                if not cleaned_option:
                    raise serializers.ValidationError(f"Вариант {j + 1} в вопросе {i + 1} не может быть пустым")

                is_correct = bool(opt.get("is_correct", False))
                if is_correct:
                    has_correct = True

                valid_options.append({
                    "option": cleaned_option,
                    "is_correct": is_correct
                })

            if not has_correct:
                raise serializers.ValidationError(f"В вопросе {i + 1} должен быть хотя бы один правильный вариант")

            q["options"] = valid_options

        return value


class TrueFalseTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrueFalseTask
        fields = ["statements"]

    def validate_statements(self, value):
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("Должно быть хотя бы одно утверждение")
        if len(value) < 1:
            raise serializers.ValidationError("Должно быть хотя бы одно утверждение")

        for i, stmt in enumerate(value):
            if not isinstance(stmt, dict):
                raise serializers.ValidationError(f"Утверждение {i + 1} должно быть словарем")

            statement_text = stmt.get("statement", "")
            if not isinstance(statement_text, str):
                raise serializers.ValidationError(f"Текст утверждения {i + 1} должен быть строкой")

            stmt["statement"] = clean_text_style(statement_text.strip())
            if not stmt["statement"]:
                raise serializers.ValidationError(f"Утверждение {i + 1} не может быть пустым")

            stmt["is_true"] = bool(stmt.get("is_true", False))

        return value


class FillGapsTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = FillGapsTask
        fields = ["text", "answers", "list_type"]
        read_only_fields = ["answers"]

    def validate(self, data):
        text = data.get("text", "")
        if not isinstance(text, str):
            raise serializers.ValidationError({"text": "Текст должен быть строкой"})

        text = clean_text_style(text.strip())
        if not text:
            raise serializers.ValidationError({"text": "Текст не может быть пустым"})

        found_blanks = re.findall(r"\[(.*?)\]", text)
        if not found_blanks:
            raise serializers.ValidationError({
                "text": "Текст должен содержать хотя бы один пропуск в формате [текст]"
            })

        for blank in found_blanks:
            if not blank.strip():
                raise serializers.ValidationError({
                    "text": "Пропуски не могут быть пустыми. Используйте формат [ваш_текст]"
                })

        data["text"] = text
        data["answers"] = found_blanks
        data["list_type"] = data.get("list_type", "open")
        return data


class MatchCardsTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = MatchCardsTask
        fields = ["cards", "shuffled_cards", "total_answers"]
        read_only_fields = ["shuffled_cards", "total_answers"]

    def _sanitize_text(self, text: str) -> str:
        if not isinstance(text, str):
            return ""
        text = strip_tags(text)
        text = re.sub(r"[<>/{}[\]();]", "", text)
        text = text.replace("\u2028", "").replace("\u2029", "")
        return text.strip()

    def validate_cards(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Карточки должны быть списком")
        if len(value) < 2:
            raise serializers.ValidationError("Должно быть как минимум 2 пары карточек")

        normalized = []
        left_set = set()
        right_set = set()

        for i, item in enumerate(value):
            if not isinstance(item, dict):
                raise serializers.ValidationError(f"Карточка {i + 1} должна быть словарем")

            left = item.get("card_left", "")
            right = item.get("card_right", "")

            if not isinstance(left, str):
                raise serializers.ValidationError(f"Левая часть карточки {i + 1} должна быть строкой")
            if not isinstance(right, str):
                raise serializers.ValidationError(f"Правая часть карточки {i + 1} должна быть строкой")

            left = self._sanitize_text(left)
            right = self._sanitize_text(right)

            if not left:
                raise serializers.ValidationError(f"Левая часть карточки {i + 1} не может быть пустой")
            if not right:
                raise serializers.ValidationError(f"Правая часть карточки {i + 1} не может быть пустой")

            if left in left_set:
                raise serializers.ValidationError(f"Повторяющаяся левая карточка: '{left}'")
            if right in right_set:
                raise serializers.ValidationError(f"Повторяющаяся правая карточка: '{right}'")

            left_set.add(left)
            right_set.add(right)
            normalized.append({"card_left": left, "card_right": right})

        return normalized


class NoteTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteTask
        fields = ["content"]

    def validate_content(self, value):
        if not isinstance(value, str):
            raise serializers.ValidationError("Содержимое должно быть строкой")

        value = value.strip()
        if not value:
            raise serializers.ValidationError("Содержимое заметки не может быть пустым")

        return value


class TextInputTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = TextInputTask
        fields = ["prompt", "default_text"]

    def validate_prompt(self, value):
        if not isinstance(value, str):
            raise serializers.ValidationError("Текст задания должен быть строкой")

        value = clean_text_style(value)
        if not value.strip():
            raise serializers.ValidationError("Текст задания не может быть пустым")
        return value

    def validate_default_text(self, value):
        if value and not isinstance(value, str):
            raise serializers.ValidationError("Текст по умолчанию должен быть строкой")
        return clean_text_style(value) if value else ""


class IntegrationTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntegrationTask
        fields = ["embed_code"]

    def validate_embed_code(self, value):
        if not isinstance(value, str):
            raise serializers.ValidationError("Embed-код должен быть строкой")

        value = value.strip()
        if not value:
            raise serializers.ValidationError("Embed-код не может быть пустым")

        if '<iframe' not in value:
            raise serializers.ValidationError("Код должен содержать iframe")

        match = re.search(r'src=["\']([^"\']+)["\']', value)
        if not match:
            raise serializers.ValidationError("Не найден src у iframe")

        src = match.group(1)
        hostname = urlparse(src).hostname or ""

        allowed_domains = (
            'wordwall.net',
            'miro.com',
            'quizlet.com',
            'learningapps.org',
            'rutube.ru',
            'sboard.online',
            'geogebra.org',
        )

        if not any(hostname == domain or hostname == f"www.{domain}" for domain in allowed_domains):
            raise serializers.ValidationError(
                f"Неподдерживаемый ресурс. Поддерживаются: {', '.join(allowed_domains)}"
            )

        return self._clean_embed_code(value)

    def _clean_embed_code(self, code: str) -> str:
        iframe_match = re.search(r'<iframe[^>]*(?:/>|>.*?</iframe>)', code, re.DOTALL)
        if not iframe_match:
            raise serializers.ValidationError("Не удалось найти корректный iframe в коде")

        iframe = iframe_match.group(0)

        allowed_attrs = {
            'src', 'width', 'height', 'frameborder', 'allow',
            'allowfullscreen', 'title', 'style', 'class', 'sandbox'
        }

        clean_attrs = {}
        for attr in allowed_attrs:
            match = re.search(rf'{attr}=(["\'])(.*?)\1', iframe)
            if match:
                clean_attrs[attr] = match.group(2)
        clean_attrs['sandbox'] = 'allow-scripts allow-same-origin allow-popups allow-forms'

        clean_attrs['style'] = clean_attrs.get('style', 'border: none; max-width: 100%;')

        attrs_string = " ".join(f'{k}="{v}"' for k, v in clean_attrs.items())
        return f'<iframe {attrs_string}></iframe>'


class FileTaskSerializer(serializers.ModelSerializer):
    file = serializers.FileField(write_only=True)
    file_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = FileTask
        fields = ["id", "file", "file_url"]

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        return None

    def validate(self, data):
        if 'file' not in data and not self.instance:
            raise serializers.ValidationError({"file": "Файл обязателен"})
        return data

    def validate_file(self, value):
        if not value:
            raise serializers.ValidationError("Файл обязателен")

        allowed_extensions = [".pdf", ".mp4", ".webm", ".ogg", ".mp3", ".wav",
                              ".png", ".jpg", ".jpeg", ".gif", ".webp"]

        allowed_types = [
            'application/pdf',
            'video/mp4', 'video/webm', 'video/ogg',
            'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
            'image/png', 'image/jpeg', 'image/gif', 'image/webp'
        ]

        file_name = value.name.lower()
        if not any(file_name.endswith(ext) for ext in allowed_extensions):
            raise serializers.ValidationError(
                f"Допустимые форматы: {', '.join([ext.lstrip('.') for ext in allowed_extensions])}"
            )

        if value.content_type not in allowed_types:
            raise serializers.ValidationError("Недопустимый тип файла")

        max_size = 50 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("Максимальный размер файла: 50 МБ")

        return value

    def create(self, validated_data):
        file = validated_data.pop('file')
        return FileTask.objects.create(file=file)

    def update(self, instance, validated_data):
        file = validated_data.pop('file', None)
        if file:
            instance.file.delete(save=False)
            instance.file = file
            instance.save()
        return instance