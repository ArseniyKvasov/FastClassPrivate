import re
import unicodedata


def normalize_answer_string(text: str) -> str:
    """
    Нормализует строку для сравнения ответов.

    Args:
        text (str): Исходная строка

    Returns:
        str: Нормализованная строка
    """
    if not isinstance(text, str):
        return ""

    text = text.lower()

    text = unicodedata.normalize('NFKD', text)
    text = ''.join(c for c in text if not unicodedata.combining(c))

    text = text.replace('—', '-')
    text = text.replace('–', '-')
    text = text.replace('−', '-')
    text = text.replace('―', '-')

    text = text.replace('’', "'")
    text = text.replace('‘', "'")
    text = text.replace('´', "'")
    text = text.replace('`', "'")

    text = text.replace('"', "'")
    text = text.replace('“', "'")
    text = text.replace('”', "'")
    text = text.replace('«', "'")
    text = text.replace('»', "'")

    text = re.sub(r'[^\w\s\'-]', '', text)

    text = re.sub(r'\s+', ' ', text).strip()

    text = re.sub(r'\bi\s+am\b', "i'm", text)
    text = re.sub(r'\bwas\s+not\b', "wasn't", text)
    text = re.sub(r'\bwere\s+not\b', "weren't", text)
    text = re.sub(r'\bdo\s+not\b', "don't", text)
    text = re.sub(r'\bdoes\s+not\b', "doesn't", text)
    text = re.sub(r'\bdid\s+not\b', "didn't", text)
    text = re.sub(r'\bhave\s+not\b', "haven't", text)
    text = re.sub(r'\bhas\s+not\b', "hasn't", text)
    text = re.sub(r'\bhad\s+not\b', "hadn't", text)
    text = re.sub(r'\bwill\s+not\b', "won't", text)
    text = re.sub(r'\bwould\s+not\b', "wouldn't", text)
    text = re.sub(r'\bshould\s+not\b', "shouldn't", text)
    text = re.sub(r'\bcould\s+not\b', "couldn't", text)
    text = re.sub(r'\bcan\s+not\b', "can't", text)
    text = re.sub(r'\bcannot\b', "can't", text)
    text = re.sub(r'\bmust\s+not\b', "mustn't", text)

    text = re.sub(r'\s*-\s*', '-', text)

    return text


def compare_normalized_answers(answer1: str, answer2: str) -> bool:
    """
    Сравнивает две строки после нормализации.

    Args:
        answer1 (str): Первая строка для сравнения
        answer2 (str): Вторая строка для сравнения

    Returns:
        bool: True если строки эквивалентны после нормализации
    """
    return normalize_answer_string(answer1) == normalize_answer_string(answer2)