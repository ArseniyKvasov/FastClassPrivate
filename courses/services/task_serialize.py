def serialize_task_data(task):
    try:
        obj = task.specific
        if task.task_type == "image":
            return {
                "image_url": getattr(obj, "image", None) and obj.image.url,
                "caption": getattr(obj, "caption", "") or ""
            }
        if task.task_type == "fill_gaps":
            return {"text": getattr(obj, "text", ""), "answers": getattr(obj, "answers", [])}
        if task.task_type == "note":
            return {"content": getattr(obj, "content", "")}
        if task.task_type == "true_false":
            statements = getattr(obj, "statements", [])
            return {"statements": [{"statement": s.get("statement", ""), "is_true": s.get("is_true", False)} for s in
                                   statements]}
        if task.task_type == "test":
            questions = getattr(obj, "questions", [])
            return {
                "questions": [{"question": q.get("question", ""), "options": q.get("options", [])} for q in questions]}
        if task.task_type == "match_cards":
            return {"cards": getattr(obj, "cards", []), "shuffled_cards": getattr(obj, "shuffled_cards", [])}
        if task.task_type == "text_input":
            return {"prompt": getattr(obj, "prompt", ""), "default_text": getattr(obj, "default_text", "") or ""}
        if task.task_type == "integration":
            return {"embed_code": getattr(obj, "embed_code", "")}
        return {}
    except Exception as e:
        print("Ошибка сериализации задачи:", e)
        return {}