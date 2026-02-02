import { showNotification } from "/static/js/tasks/utils.js";

/**
 * Рендерит редактор задания типа «Текстовая заметка» на Markdown.
 *
 * @param {{content?: string}|null} taskData
 * @returns {HTMLElement}
 */
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

        <div class="toolbar mb-2 d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-light border format-btn" data-md="**">
                <i class="bi bi-type-bold"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-md="*">
                <i class="bi bi-type-italic"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-md="__">
                <i class="bi bi-type-underline"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-md="- ">
                <i class="bi bi-list-ul"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-md="1. ">
                <i class="bi bi-list-ol"></i>
            </button>
            <button class="btn btn-sm btn-light border clear-format-btn">
                <i class="bi bi-eraser"></i>
            </button>
        </div>

        <textarea
            class="note-editor border rounded p-2 w-100"
            style="min-height: 160px; outline: none; resize: vertical;"
        >${content}</textarea>

        <button class="btn btn-success mt-3 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const editor = card.querySelector(".note-editor");

    const wrapSelection = (before, after = before) => {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const value = editor.value;

        editor.value =
            value.slice(0, start) +
            before +
            value.slice(start, end) +
            after +
            value.slice(end);

        editor.focus();
        editor.selectionStart = start + before.length;
        editor.selectionEnd = end + before.length;
    };

    const insertAtLineStart = (prefix) => {
        const start = editor.selectionStart;
        const value = editor.value;
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;

        editor.value =
            value.slice(0, lineStart) +
            prefix +
            value.slice(lineStart);

        editor.focus();
        editor.selectionStart = editor.selectionEnd = start + prefix.length;
    };

    card.querySelectorAll(".format-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const md = btn.dataset.md;

            if (md === "- " || md === "1. ") {
                insertAtLineStart(md);
            } else {
                wrapSelection(md);
            }
        });
    });

    card.querySelector(".clear-format-btn")
        .addEventListener("click", () => {
            editor.value = editor.value.replace(/[*_`#>-]/g, "");
            editor.focus();
        });

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => card.remove());

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}
