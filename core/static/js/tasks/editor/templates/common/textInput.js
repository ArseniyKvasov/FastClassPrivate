import { showNotification, escapeHtml } from "/static/js/tasks/utils.js";

/**
 * Рендер редактора текстового задания.
 *
 * Поддерживает inline-режим и режим редактирования в модальном окне.
 *
 * @param {{prompt?: string, default_text?: string}|null} taskData
 */
export function renderTextInputTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    const promptValue = escapeHtml(taskData?.prompt || "");
    const defaultTextValue = escapeHtml(taskData?.default_text || "");

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Текстовое задание</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="mb-2">
            <input
                type="text"
                class="form-control task-prompt"
                placeholder="Введите заголовок"
                value="${promptValue}" autofocus>
        </div>

        <div class="mb-2">
            <textarea
                class="form-control task-default-text"
                rows="3"
                placeholder="Текст по умолчанию (опционально)">${defaultTextValue}</textarea>
        </div>

        <button class="btn btn-success mt-3 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const removeBtn = card.querySelector(".remove-task-btn");
    const saveBtn = card.querySelector(".save-btn");

    removeBtn.addEventListener("click", () => card.remove());

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}
