"""
Реестр всех моделей ответов для задания.
Использование: from answers.registry import ANSWER_MODELS
"""

from .models import (
    TestTaskAnswer,
    TrueFalseTaskAnswer,
    FillGapsTaskAnswer,
    MatchCardsTaskAnswer,
    TextInputTaskAnswer,
)

ANSWER_MODELS = [
    TestTaskAnswer,
    TrueFalseTaskAnswer,
    FillGapsTaskAnswer,
    MatchCardsTaskAnswer,
    TextInputTaskAnswer,
]

ANSWER_MODELS_BY_TASK_TYPE = {
    "test": TestTaskAnswer,
    "true_false": TrueFalseTaskAnswer,
    "fill_gaps": FillGapsTaskAnswer,
    "match_cards": MatchCardsTaskAnswer,
    "text_input": TextInputTaskAnswer,
}

TASK_TO_ANSWER_MODEL = {
    'courses.TestTask': TestTaskAnswer,
    'courses.TrueFalseTask': TrueFalseTaskAnswer,
    'courses.FillGapsTask': FillGapsTaskAnswer,
    'courses.MatchCardsTask': MatchCardsTaskAnswer,
    'courses.TextInputTask': TextInputTaskAnswer,
}

def get_answer_model_for_task(task_instance):
    """
    Получить модель ответа для конкретного задания.

    Args:
        task_instance: Экземпляр модели задания

    Returns:
        Класс модели ответа или None, если не найден
    """
    model_name = f'{task_instance._meta.app_label}.{task_instance._meta.model_name}'
    return TASK_TO_ANSWER_MODEL.get(model_name)

def get_answer_model_by_task_type(task_type):
    """
    Получить модель ответа по строковому типу задания.

    Args:
        task_type: Тип задания как строка ('test', 'truefalse', и т.д.)

    Returns:
        Класс модели ответа или None, если не найден
    """
    return ANSWER_MODELS_BY_TASK_TYPE.get(task_type)

def get_all_answer_models():
    """
    Получить все модели ответов.

    Returns:
        Кортеж всех зарегистрированных моделей ответов
    """
    return tuple(ANSWER_MODELS)

def validate_task_type(task_type):
    """
    Проверить, существует ли тип задания.

    Args:
        task_type: Тип задания для проверки

    Returns:
        bool: True если тип существует
    """
    return task_type in ANSWER_MODELS_BY_TASK_TYPE

def get_all_task_types():
    """
    Получить все доступные типы заданий.

    Returns:
        Список строковых типов заданий
    """
    return list(ANSWER_MODELS_BY_TASK_TYPE.keys())
