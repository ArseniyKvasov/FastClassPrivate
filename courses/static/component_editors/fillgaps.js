/**
 * Рендер редактора задания "Заполни пропуски".
 * Если передан taskId — открывает редактор в модальном окне для редактирования.
 * Если container не указан — вставляет редактор в список заданий.
 */
function renderFillGapsTaskEditor(taskId = null, container = null, taskData = null) {
    const parent = container || document.getElementById("task-list");
    if (!parent) return;

    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    const textValue = taskData?.text || "";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Заполни пропуски</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="toolbar mb-2 d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-light border format-btn" data-cmd="bold" title="Жирный">
                <i class="bi bi-type-bold"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="italic" title="Курсив">
                <i class="bi bi-type-italic"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="underline" title="Подчеркнутый">
                <i class="bi bi-type-underline"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="insertUnorderedList" title="Маркированный список">
                <i class="bi bi-list-ul"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="insertOrderedList" title="Нумерованный список">
                <i class="bi bi-list-ol"></i>
            </button>
            <button class="btn btn-sm btn-light border insert-gap-btn" title="Вставить пропуск">
                <i class="bi bi-square"></i> Пропуск
            </button>
            <button class="btn btn-sm btn-light border clear-format-btn" title="Сбросить стили">
                <i class="bi bi-eraser"></i>
            </button>
        </div>

        <div class="mb-3">
            <label class="form-label mb-1">Текст с пропусками</label>
            <div class="fill-text-editor border rounded p-2"
                 contenteditable="true"
                 style="min-height: 120px; outline: none;">${textValue}</div>
        </div>

        <button class="btn btn-success mt-3 w-100 fw-semibold">
            Сохранить
        </button>
    `;

    const editor = card.querySelector(".fill-text-editor");

    card.querySelectorAll(".format-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.execCommand(btn.dataset.cmd, false, null);
            editor.focus();
        });
    });

    card.querySelector(".insert-gap-btn").addEventListener("click", () => {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const textNode = document.createTextNode("[]");
            range.insertNode(textNode);

            range.setStart(textNode, 1);
            range.setEnd(textNode, 1);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        editor.focus();
    });

    card.querySelector(".clear-format-btn").addEventListener("click", () => {
        const html = editor.innerText;
        editor.innerHTML = html;
        editor.focus();
    });

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => {
            if (taskId && bootstrapEditorModal) {
                bootstrapEditorModal.hide();
            } else {
                card.remove();
            }
        });

    card.querySelector(".btn-success")
        .addEventListener("click", () => saveTask("fill_gaps", card, taskId));

    if (taskId) {
        if (!editorModal) {
            editorModal = document.createElement("div");
            editorModal.className = "modal fade";
            editorModal.tabIndex = -1;
            editorModal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content p-3"></div>
                </div>
            `;
            document.body.appendChild(editorModal);
            bootstrapEditorModal = new bootstrap.Modal(editorModal);
        }

        const content = editorModal.querySelector(".modal-content");
        content.innerHTML = "";
        content.appendChild(card);
        bootstrapEditorModal.show();
        return;
    }

    if (container) {
        parent.innerHTML = "";
        parent.appendChild(card);
    } else {
        parent.appendChild(card);
    }

    card.scrollIntoView({ behavior: "smooth", block: "center" });
}