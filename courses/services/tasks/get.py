import random
from courses.models import Task, TestTask, NoteTask, TrueFalseTask, FillGapsTask, MatchCardsTask, TextInputTask, WordListTask, \
    FileTask, IntegrationTask


def get_task_data(task: Task, to_frontend=True) -> dict:
    """
    Возвращает данные задачи

    Args:
        task: Объект Task
        to_frontend: Если True - данные подготовлены для фронтенда:
            - FillGapsTask: скрываются ответы в тексте (удаляется содержимое [скобок])
            - FillGapsTask: ответы перемешиваются
            - FileTask: возвращается file_path (URL) вместо file.name
    """
    if not task:
        raise ValueError("Task не передан")

    specific_obj = getattr(task, "specific", None)
    if not specific_obj:
        raise ValueError("Task.specific отсутствует")

    data = {}

    if task.task_type == "test" and isinstance(specific_obj, TestTask):
        data["questions"] = getattr(specific_obj, "questions", [])
    elif task.task_type == "true_false" and isinstance(specific_obj, TrueFalseTask):
        data["statements"] = getattr(specific_obj, "statements", [])
    elif task.task_type == "note" and isinstance(specific_obj, NoteTask):
        data["content"] = getattr(specific_obj, "content", "")
    elif task.task_type == "fill_gaps" and isinstance(specific_obj, FillGapsTask):
        import re

        text = getattr(specific_obj, "text", "")
        answers = getattr(specific_obj, "answers", [])

        if to_frontend:
            text = re.sub(r'\[(.*?)\]', '[]', text)
            if isinstance(answers, list):
                answers = random.sample(answers, len(answers)) if answers else []

        data["text"] = text
        data["list_type"] = getattr(specific_obj, "list_type", "open")
        data["answers"] = answers

    elif task.task_type == "match_cards" and isinstance(specific_obj, MatchCardsTask):
        data["cards"] = getattr(specific_obj, "cards", [])
        data["shuffled_cards"] = getattr(specific_obj, "shuffled_cards", [])
    elif task.task_type == "text_input" and isinstance(specific_obj, TextInputTask):
        data["prompt"] = getattr(specific_obj, "prompt", "")
        data["default_text"] = getattr(specific_obj, "default_text", "")
    elif task.task_type == "integration" and isinstance(specific_obj, IntegrationTask):
        data["embed_code"] = getattr(specific_obj, "embed_code", "")
    elif task.task_type == "file" and isinstance(specific_obj, FileTask):
        if specific_obj.file:
            data["file_path"] = specific_obj.file.url
        else:
            data["file_path"] = None
    elif task.task_type == "word_list" and isinstance(specific_obj, WordListTask):
        data["words"] = getattr(specific_obj, "words", [])
    else:
        raise ValueError(f"Unsupported task type {task.task_type} or invalid specific object")

    return data
