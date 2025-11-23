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
        left_cards = set()
        right_cards = set()

        for item in value:
            left = self._sanitize_text(item.get("card_left", ""))
            right = self._sanitize_text(item.get("card_right", ""))

            if left and right:
                if left in left_cards:
                    raise serializers.ValidationError("Найдены одинаковые левые карточки")

                if right in right_cards:
                    raise serializers.ValidationError("Найдены одинаковые правые карточки")

                left_cards.add(left)
                right_cards.add(right)
                normalized.append({
                    "card_left": left,
                    "card_right": right
                })

        if not normalized:
            raise serializers.ValidationError("Нужно хотя бы одну заполненную пару")

        if len(normalized) < 2:
            raise serializers.ValidationError("Добавьте как минимум две пары карточек")

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


class IntegrationTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntegrationTask
        fields = ["embed_code"]

    def validate_embed_code(self, value):
        """
        Валидация embed-кода:
        1. Проверяем наличие iframe
        2. Проверяем поддерживаемые домены
        3. Очищаем от опасного кода
        """
        if not value:
            raise serializers.ValidationError("Embed-код не может быть пустым")

        if '<iframe' not in value:
            raise serializers.ValidationError("Код должен содержать iframe")

        supported_domains = [
            'youtube.com', 'youtu.be', 'wordwall.net', 'miro.com',
            'quizlet.com', 'learningapps.org', 'rutube.ru', 'sboard.online'
        ]

        has_supported_domain = any(domain in value for domain in supported_domains)
        if not has_supported_domain:
            raise serializers.ValidationError(
                f"Неподдерживаемый ресурс. Поддерживаются: {', '.join(supported_domains)}"
            )

        cleaned_code = self._clean_embed_code(value)

        return cleaned_code

    def _clean_embed_code(self, code):
        """
        Очистка embed-кода с помощью регулярных выражений
        """
        import re

        iframe_match = re.search(r'<iframe[^>]*(?:/>|>.*?</iframe>)', code, re.DOTALL)
        if not iframe_match:
            raise serializers.ValidationError("Не удалось найти корректный iframe в коде")

        iframe_full = iframe_match.group(0)

        iframe_open_match = re.search(r'<iframe[^>]*>', iframe_full)
        iframe_open = iframe_open_match.group(0) if iframe_open_match else iframe_full

        allowed_attrs = {
            'src', 'width', 'height', 'frameborder', 'allow',
            'allowfullscreen', 'title', 'style', 'class', 'sandbox'
        }

        safe_css_props = {
            'width', 'height', 'border', 'max-width', 'max-height',
            'display', 'margin', 'padding', 'background'
        }

        attrs = {}
        for attr in allowed_attrs:
            attr_match = re.search(r'\b' + attr + r'=(["\'])(.*?)\1', iframe_open)
            if not attr_match:
                attr_match = re.search(r'\b' + attr + r'=([^\s>]+)', iframe_open)

            if attr_match:
                attr_value = attr_match.group(2) if '"' in iframe_open else attr_match.group(1)
                attrs[attr] = attr_value

        if 'style' in attrs:
            safe_css_props = {'width', 'height', 'border', 'max-width', 'max-height',
                              'display', 'margin', 'padding', 'background'}
            styles = attrs['style'].split(';')
            clean_styles = []
            for style in styles:
                if ':' in style:
                    prop, val = style.split(':', 1)
                    prop = prop.strip().lower()
                    if prop in safe_css_props:
                        val = re.sub(r'[<>{}]', '', val.strip())
                        clean_styles.append(f"{prop}:{val}")
            attrs['style'] = '; '.join(clean_styles)

        attrs['sandbox'] = 'allow-scripts allow-same-origin allow-popups allow-forms'

        base_style = 'border: none; max-width: 100%;'
        if 'style' in attrs:
            if 'border' not in attrs['style'].lower():
                attrs['style'] += '; border: none;'
            if 'max-width' not in attrs['style'].lower():
                attrs['style'] += '; max-width: 100%;'
        else:
            attrs['style'] = base_style

        if any(domain in attrs.get('src', '') for domain in ['youtube.com', 'youtu.be', 'rutube.ru']):
            attrs['allowfullscreen'] = 'true'
            attrs['allow'] = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'

        clean_attrs = ' '.join([f'{k}="{v}"' for k, v in attrs.items()])
        clean_iframe = f'<iframe {clean_attrs}></iframe>'

        return clean_iframe


TASK_SERIALIZER_MAP = {
    "test": TestTaskSerializer,
    "note": NoteTaskSerializer,
    "image": ImageTaskSerializer,
    "true_false": TrueFalseTaskSerializer,
    "fill_gaps": FillGapsTaskSerializer,
    "match_cards": MatchCardsTaskSerializer,
    "text_input": TextInputTaskSerializer,
    "integration": IntegrationTaskSerializer,
}
