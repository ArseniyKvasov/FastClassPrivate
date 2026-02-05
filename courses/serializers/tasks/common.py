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

SAFE_TAGS = ["b", "i", "u", "em", "strong", "ul", "ol", "li",
             "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
             "blockquote", "code", "pre", "table", "thead", "tbody", "tr", "th", "td",
             "a", "img", "div", "span"]

SAFE_ATTRIBUTES = {
    "*": ["class", "id"],
    "a": ["href", "title", "target"],
    "img": ["src", "alt", "title", "width", "height"],
}

CSS_SANITIZER = CSSSanitizer(
    allowed_css_properties=[
        "font-weight", "font-style", "text-decoration",
        "color", "background-color",
        "width", "height", "border", "max-width", "max-height",
        "display", "margin", "padding"
    ]
)


def clean_text_style(text: str) -> str:
    cleaned = bleach.clean(
        text,
        tags=SAFE_TAGS,
        attributes=SAFE_ATTRIBUTES,
        css_sanitizer=CSS_SANITIZER,
        strip=True
    )
    lines = [line.strip() for line in cleaned.splitlines() if line.strip()]
    return "".join(f"{line}" for line in lines)


class TestTaskSerializer(serializers.ModelSerializer):
    """Сериализатор для тестовых задач."""
    class Meta:
        model = TestTask
        fields = ["questions"]

    def validate_questions(self, value):
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("Нужно хотя бы один вопрос")

        for q in value:
            q["question"] = clean_text_style(q.get("question", "").strip())
            if not q["question"]:
                raise serializers.ValidationError("Вопрос не может быть пустым")

            options = [o for o in q.get("options", []) if o.get("option", "").strip()]
            if not options:
                raise serializers.ValidationError("Нужно хотя бы один вариант ответа")
            if not any(o.get("is_correct") for o in options):
                raise serializers.ValidationError("Хотя бы один вариант должен быть правильным")
            for o in options:
                o["option"] = clean_text_style(o.get("option", "").strip())
            q["options"] = options

        return value


class TrueFalseTaskSerializer(serializers.ModelSerializer):
    """Сериализатор для задач "Правда/Ложь"."""
    class Meta:
        model = TrueFalseTask
        fields = ["statements"]

    def validate_statements(self, value):
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("Нужно хотя бы одно утверждение")

        for stmt in value:
            stmt["statement"] = clean_text_style(stmt.get("statement", "").strip())
            if not stmt["statement"]:
                raise serializers.ValidationError("Утверждение не может быть пустым")
            stmt["is_true"] = bool(stmt.get("is_true", False))

        return value


class FillGapsTaskSerializer(serializers.ModelSerializer):
    """Сериализатор для задач на заполнение пропусков."""
    class Meta:
        model = FillGapsTask
        fields = ["text", "answers", "list_type"]
        read_only_fields = ["answers"]

    def validate(self, data):
        text = clean_text_style(data.get("text", "").strip())
        if not text:
            raise serializers.ValidationError({"text": "Текст не может быть пустым"})

        found_blanks = re.findall(r"\[(.*?)\]", text)
        if not found_blanks:
            raise serializers.ValidationError({
                "text": "Текст должен содержать хотя бы один пропуск в формате [текст]"
            })

        data["text"] = text
        data["answers"] = found_blanks
        data["list_type"] = data.get("list_type", "open")
        return data


class MatchCardsTaskSerializer(serializers.ModelSerializer):
    """Сериализатор для задач на сопоставление карточек."""

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

        normalized, left_set, right_set = [], set(), set()

        for item in value:
            if not isinstance(item, dict):
                continue

            left = self._sanitize_text(item.get("card_left", ""))
            right = self._sanitize_text(item.get("card_right", ""))

            if left and right:
                if left in left_set:
                    raise serializers.ValidationError("Найдены одинаковые левые карточки")
                if right in right_set:
                    raise serializers.ValidationError("Найдены одинаковые правые карточки")
                left_set.add(left)
                right_set.add(right)
                normalized.append({"card_left": left, "card_right": right})
            elif left or right:
                raise serializers.ValidationError("Обе части карточки должны быть заполнены")

        if len(normalized) < 2:
            raise serializers.ValidationError("Добавьте как минимум две заполненные пары карточек")

        return normalized


class NoteTaskSerializer(serializers.ModelSerializer):
    """Сериализатор для задач-заметок."""
    class Meta:
        model = NoteTask
        fields = ["content"]

    def validate_content(self, value):
        value = value or ""
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Содержимое заметки не может быть пустым")

        return value


class TextInputTaskSerializer(serializers.ModelSerializer):
    """Сериализатор для задач на ввод текста."""
    class Meta:
        model = TextInputTask
        fields = ["prompt", "default_text"]

    def validate_prompt(self, value):
        value = clean_text_style(value)
        if not value.strip():
            raise serializers.ValidationError("Текст задания не может быть пустым")
        return value

    def validate_default_text(self, value):
        return clean_text_style(value)


class IntegrationTaskSerializer(serializers.ModelSerializer):
    """Сериализатор для задач интеграции с внешними ресурсами."""
    class Meta:
        model = IntegrationTask
        fields = ["embed_code"]

    def validate_embed_code(self, value):
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
            'youtube.com',
            'youtu.be',
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
                f"Неподдерживаемый ресурс. Поддерживаются только основной домен и www-поддомен: {', '.join(allowed_domains)}"
            )

        return self._clean_embed_code(value)

    def _clean_embed_code(self, code: str) -> str:
        import re
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
    """Сериализатор для задач с файлами."""
    file = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = FileTask
        fields = ["file_path", "file"]

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