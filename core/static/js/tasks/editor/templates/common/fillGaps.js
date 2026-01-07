import { showNotification } from "@tasks/utils.js";

/**
 * Рендерит редактор задания типа «Заполни пропуски».
 *
 * @param {Object|null} taskData
 * @param {string} [taskData.text]
 * @param {string} [taskData.task_type]
 */
export function renderFillGapsTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    const htmlContent = taskData?.text || "";
    const taskType = taskData?.task_type || "hidden";

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

        <div class="toolbar mb-2 d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-light border format-btn" data-cmd="bold"><i class="bi bi-type-bold"></i></button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="italic"><i class="bi bi-type-italic"></i></button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="underline"><i class="bi bi-type-underline"></i></button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="insertUnorderedList"><i class="bi bi-list-ul"></i></button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="insertOrderedList"><i class="bi bi-list-ol"></i></button>
            <button class="btn btn-sm btn-light border insert-gap-btn"><i class="bi bi-square"></i> Пропуск</button>
            <button class="btn btn-sm btn-light border clear-format-btn"><i class="bi bi-eraser"></i></button>
        </div>

        <div class="mb-3">
            <div class="fill-text-editor border rounded p-2"
                 contenteditable="true"
                 style="min-height: 120px; outline: none;">${htmlContent}</div>
        </div>

        <div class="mb-3">
            <div class="border rounded p-2 bg-light">
                <div class="gaps-preview-list"></div>
            </div>
        </div>

        <button class="btn btn-success mt-3 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const editor = card.querySelector(".fill-text-editor");
    const gapsPreviewList = card.querySelector(".gaps-preview-list");

    function updateGapsPreview() {
        const text = editor.innerHTML;
        const answers = [];
        const regex = /\[([^\]]*)\]/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            answers.push(match[1]);
        }

        gapsPreviewList.innerHTML = answers.length
            ? answers.map(a => `<span class="badge bg-primary me-1 mb-1">${a}</span>`).join("")
            : '<span class="text-muted">Пропуски не найдены</span>';
    }

    editor.addEventListener("input", updateGapsPreview);
    editor.addEventListener("paste", () => setTimeout(updateGapsPreview, 50));

    card.querySelectorAll(".format-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.execCommand(btn.dataset.cmd, false, null);
            editor.focus();
            updateGapsPreview();
        });
    });

    card.querySelector(".insert-gap-btn").addEventListener("click", () => {
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
        updateGapsPreview();
    });

    card.querySelector(".clear-format-btn").addEventListener("click", () => {
        editor.innerHTML = editor.innerText.replace(/\n/g, "<br>");
        editor.focus();
        updateGapsPreview();
    });

    card.querySelector(".remove-task-btn").addEventListener("click", () => card.remove());

    updateGapsPreview();

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}
