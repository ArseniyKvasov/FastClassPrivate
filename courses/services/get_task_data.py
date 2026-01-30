from courses.models import Task, TestTask, TrueFalseTask, FillGapsTask, MatchCardsTask, TextInputTask, ImageTask, WordListTask


def get_task_effective_data(task: Task) -> dict:
    """
    Возвращает данные задачи с учётом edited_content.
    Если есть edited_content, оно накладывается поверх данных specific.
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
    elif task.task_type == "fill_gaps" and isinstance(specific_obj, FillGapsTask):
        data["text"] = getattr(specific_obj, "text", "")
        data["answers"] = getattr(specific_obj, "answers", [])
    elif task.task_type == "match_cards" and isinstance(specific_obj, MatchCardsTask):
        data["cards"] = getattr(specific_obj, "cards", [])
        data["shuffled_cards"] = getattr(specific_obj, "shuffled_cards", [])
    elif task.task_type == "text_input" and isinstance(specific_obj, TextInputTask):
        data["prompt"] = getattr(specific_obj, "prompt", "")
        data["default_text"] = getattr(specific_obj, "default_text", "")
    elif task.task_type == "image" and isinstance(specific_obj, ImageTask):
        data["file_path"] = getattr(specific_obj, "file_path", None)
        data["caption"] = getattr(specific_obj, "caption", "")
    elif task.task_type == "word_list" and isinstance(specific_obj, WordListTask):
        data["words"] = getattr(specific_obj, "words", [])
    else:
        raise ValueError(f"Unsupported task type {task.task_type} or invalid specific object")

    if task.edited_content and isinstance(task.edited_content, dict):
        data.update(task.edited_content)

    return data
