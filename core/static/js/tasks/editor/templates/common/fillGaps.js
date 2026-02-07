import { showNotification } from "/static/js/tasks/utils.js";
import { createRichTextEditor } from "/static/js/tasks/editor/textFormatting.js";

export function renderFillGapsTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    const htmlContent = taskData?.text || "";
    const taskType = taskData?.list_type || "hidden";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0"><i class="bi bi-pencil-square me-1"></i> Заполните пропуски</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="mb-3">
            <select class="form-select fill-gaps-type-select">
                <option value="hidden" ${taskType === "hidden" ? "selected" : ""}>Скрытый список слов</option>
                <option value="open" ${taskType === "open" ? "selected" : ""}>Открытый ввод</option>
            </select>
        </div>

        <div class="editor-container mb-3"></div>

        <div class="mb-3">
            <div class="border rounded p-2 bg-light">
                <div class="gaps-preview-list"></div>
            </div>
        </div>

        <button class="btn btn-success mt-3 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const editorContainer = card.querySelector(".editor-container");
    const gapsPreviewList = card.querySelector(".gaps-preview-list");

    const aiPromptBtn = document.createElement("button");
    aiPromptBtn.className = "btn btn-light btn-sm border";
    aiPromptBtn.innerHTML = '<i class="bi bi-robot"></i>';
    aiPromptBtn.title = "Скопировать запрос для ИИ";

    const aiPrompt = `Ты генерируешь задания «Заполни пропуски» для системы обучения. Внимательно следуй инструкциям:

КАК ФОРМИРОВАТЬ ПРОПУСКИ
1. Выдели ключевые слова, термины или числа в тексте
2. Замени каждое выделенное слово на: [слово]
3. Пример: "Столица Франции - [Париж], а Германии - [Берлин]."

Тема задания: `;

    aiPromptBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(aiPrompt).then(() => {
            showNotification("Запрос для генерации в ИИ скопирован");
        }).catch(() => {
            showNotification("Не удалось скопировать промпт");
        });
    });

    const { editor, toolbar, getHTML, setHTML } = createRichTextEditor(htmlContent);

    const insertGapBtn = document.createElement("button");
    insertGapBtn.className = "btn btn-light btn-sm border";
    insertGapBtn.innerHTML = '<i class="bi bi-square me-1"></i>Пропуск';
    insertGapBtn.title = "Вставить пропуск";

    toolbar.appendChild(insertGapBtn);
    toolbar.appendChild(aiPromptBtn);

    editorContainer.appendChild(toolbar);
    editorContainer.appendChild(editor);

    function updateGapsPreview() {
        const text = getHTML();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        const plainText = tempDiv.textContent || "";

        const answers = [];
        const regex = /\[([^\]]*)\]/g;
        let match;

        while ((match = regex.exec(plainText)) !== null) {
            let answer = match[1]
                .replace(/—/g, '-')
                .replace(/–/g, '-')
                .replace(/／/g, '/')
                .replace(/⁄/g, '/')
                .trim();

            if (answer) {
                answers.push(answer);
            }
        }

        gapsPreviewList.innerHTML = answers.length
            ? answers.map(a => `<span class="badge bg-primary me-1 mb-1">${a}</span>`).join("")
            : '<span class="text-muted">Пропуски не найдены</span>';
    }

    insertGapBtn.addEventListener("click", () => {
        editor.focus();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();

        const startBracket = document.createTextNode("[");
        const textNode = document.createTextNode("текст");
        const endBracket = document.createTextNode("]");

        range.insertNode(endBracket);
        range.insertNode(textNode);
        range.insertNode(startBracket);

        range.setStart(textNode, 0);
        range.setEnd(textNode, textNode.length);

        selection.removeAllRanges();
        selection.addRange(range);

        editor.dispatchEvent(new Event('input', { bubbles: true }));
    });

    editor.addEventListener('input', updateGapsPreview);

    card.querySelector(".remove-task-btn").addEventListener("click", () => {
        card.remove();
    });

    updateGapsPreview();

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}