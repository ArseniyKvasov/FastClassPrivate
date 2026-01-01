import { showNotification } from "../../../utils.js";

/**
 * Рендерит редактор задания типа «Текстовая заметка».
 *
 * @param {number|null} taskId
 * @param {HTMLElement|null} container
 * @param {{content?: string}|null} taskData
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
            <button class="btn btn-sm btn-light border format-btn" data-cmd="bold">
                <i class="bi bi-type-bold"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="italic">
                <i class="bi bi-type-italic"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="underline">
                <i class="bi bi-type-underline"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="insertUnorderedList">
                <i class="bi bi-list-ul"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="insertOrderedList">
                <i class="bi bi-list-ol"></i>
            </button>
            <button class="btn btn-sm btn-light border clear-format-btn">
                <i class="bi bi-eraser"></i>
            </button>
        </div>

        <div class="note-editor border rounded p-2"
             contenteditable="true"
             style="min-height: 160px; outline: none;">${content}</div>

        <button class="btn btn-success mt-3 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const editor = card.querySelector(".note-editor");

    card.querySelectorAll(".format-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.execCommand(btn.dataset.cmd, false, null);
            editor.focus();
        });
    });

    card.querySelector(".clear-format-btn")
        .addEventListener("click", () => {
            const text = editor.innerText;
            editor.innerHTML = text.replace(/\n/g, "<br>");
            editor.focus();
        });

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => card.remove());

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}
