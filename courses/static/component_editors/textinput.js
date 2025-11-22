/**
 * Рендер редактора текстового задания.
 * Если передан taskId — открывает модальное окно для редактирования.
 * taskData может содержать поля prompt и default_text.
 */
function renderTextInputTaskEditor(taskId = null, container = null, taskData = null) {
    const parent = container || document.getElementById("task-list");
    if (!parent) return;

    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    const promptValue = taskData?.prompt || "";
    const defaultTextValue = taskData?.default_text || "";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Текстовое задание</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="mb-2">
            <input type="text" class="form-control task-prompt" placeholder="Введите заголовок" value="${promptValue}">
        </div>

        <div class="mb-2">
            <textarea class="form-control task-default-text" rows="3" placeholder="Текст по умолчанию (опционально)">${defaultTextValue}</textarea>
        </div>

        <button class="btn btn-success mt-3 w-100 fw-semibold">
            Сохранить
        </button>
    `;

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => {
            if (taskId && bootstrapEditorModal) {
                bootstrapEditorModal.hide();
            } else {
                card.remove();
            }
        });

    card.querySelector(".btn-success")
        .addEventListener("click", () => saveTask("text_input", card, taskId));

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
        const contentEl = editorModal.querySelector(".modal-content");
        contentEl.innerHTML = "";
        contentEl.appendChild(card);
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
