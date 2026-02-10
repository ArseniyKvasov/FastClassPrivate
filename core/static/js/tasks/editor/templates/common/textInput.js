import { showNotification } from "js/tasks/utils.js";
import { createRichTextEditor } from "js/tasks/editor/textFormatting.js";

export function renderTextInputTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    const promptValue = taskData?.prompt || "";
    const defaultTextValue = taskData?.default_text || "";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Текстовое задание</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="editor-container mb-3"></div>

        <button class="btn btn-success mt-3 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const editorContainer = card.querySelector(".editor-container");

    const { editor, toolbar, getHTML, setHTML } = createRichTextEditor(defaultTextValue);

    editor.setAttribute("data-default-text", defaultTextValue);

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "form-control task-prompt mb-3";
    titleInput.placeholder = "Введите заголовок";
    titleInput.value = promptValue;
    titleInput.autofocus = true;

    editorContainer.appendChild(titleInput);
    editorContainer.appendChild(toolbar);
    editorContainer.appendChild(editor);

    const originalGetHTML = getHTML;
    const originalSetHTML = setHTML;

    card.querySelector(".remove-task-btn").addEventListener("click", () => card.remove());

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}