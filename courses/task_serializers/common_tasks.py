import re
import bleach
from bleach.css_sanitizer import CSSSanitizer
from django.utils.html import strip_tags
from rest_framework import serializers
from courses.models import (
    TestTask, TrueFalseTask, FillGapsTask, MatchCardsTask,
    NoteTask, ImageTask, TextInputTask, IntegrationTask
)

# Разрешённые теги и атрибуты
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
    """
    Очистка текста от опасного HTML и стилей.
    Все тексты будут в едином стиле <p>...</p>.
    """
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
    class Meta:
        model = FillGapsTask
        fields = ["text", "answers", "task_type"]
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
        return data


class MatchCardsTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = MatchCardsTask
        fields = ["cards"]

    def _sanitize_text(self, text: str) -> str:
        text = strip_tags(text)
        text = re.sub(r"[<>/{}[\]();]", "", text)
        text = text.replace("\u2028", "").replace("\u2029", "")
        return text.strip()

    def validate_cards(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Карточки должны быть списком")

        normalized, left_set, right_set = [], set(), set()

        for item in value:
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

        if len(normalized) < 2:
            raise serializers.ValidationError("Добавьте как минимум две заполненные пары карточек")

        return normalized


class NoteTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteTask
        fields = ["content"]

    def validate_content(self, value):
        value = clean_text_style(value)
        if not value.strip():
            raise serializers.ValidationError("Содержимое заметки не может быть пустым")
        return value


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

    def validate_caption(self, value):
        return clean_text_style(value)


class TextInputTaskSerializer(serializers.ModelSerializer):
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
    class Meta:
        model = IntegrationTask
        fields = ["embed_code"]

    def validate_embed_code(self, value):
        if not value:
            raise serializers.ValidationError("Embed-код не может быть пустым")
        if '<iframe' not in value:
            raise serializers.ValidationError("Код должен содержать iframe")

        allowed_domains = [
            'youtube.com', 'youtu.be', 'wordwall.net', 'miro.com',
            'quizlet.com', 'learningapps.org', 'rutube.ru', 'sboard.online'
        ]
        if not any(domain in value for domain in allowed_domains):
            raise serializers.ValidationError(
                f"Неподдерживаемый ресурс. Поддерживаются: {', '.join(allowed_domains)}"
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

        return f'<iframe {" ".join(f"{k}=\"{v}\"" for k, v in clean_attrs.items())}></iframe>'
