import { showNotification, createRichTextEditor } from "/static/js/tasks/utils.js";

export function renderNoteTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    const content = taskData?.content || "";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">
                <i class="bi bi-journal-text me-1"></i> Текстовая заметка
            </h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="editor-wrapper mb-3"></div>

        <button class="btn btn-success mt-3 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const editorWrapper = card.querySelector(".editor-wrapper");

    const aiPromptBtn = document.createElement("button");
    aiPromptBtn.type = "button";
    aiPromptBtn.className = "btn btn-sm btn-outline-secondary";
    aiPromptBtn.innerHTML = '<i class="bi bi-robot"></i>';
    aiPromptBtn.title = "Скопировать промпт для ИИ";

    const aiPrompt = `Ты генерируешь текстовые заметки для системы, которая поддерживает LaTeX. Внимательно следуй инструкций:

ФОРМАТИРОВАНИЕ
- <b>
- <i>
- <u>
- не используй другие html теги или стили

МАТЕМАТИЧЕСКИЕ ФОРМУЛЫ
- Формулы оборачивай в LaTeX:
  - Встроенные формулы: $формула$
  - Отдельные формулы: $$формула$$

Пиши внутри блока кода

Тема заметки: `;

    aiPromptBtn.addEventListener("click", () => {
        navigator.clipboard
            .writeText(aiPrompt)
            .then(() => showNotification("Запрос для генерации в ИИ скопирован"))
            .catch(() => showNotification("Не удалось скопировать промпт"));
    });

    const { editor, toolbar } = createRichTextEditor(content);

    toolbar.appendChild(aiPromptBtn);
    editorWrapper.appendChild(toolbar);
    editorWrapper.appendChild(editor);

    card.querySelector(".remove-task-btn").addEventListener("click", () => {
        card.remove();
    });

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}
