import { showNotification, escapeHtml, generateId } from "/static/js/tasks/utils.js";

/**
 * Рендер редактора задания True / False.
 *
 * @param {string|null} taskId
 * @param {HTMLElement|null} container
 * @param {{statements?: Array<{statement: string, is_true: boolean}>}|null} taskData
 */
export function renderTrueFalseTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Правда или ложь</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="truefalse-statements mb-3"></div>

        <button class="btn btn-link text-primary fw-semibold mt-3 add-statement-btn px-0" style="border:none;">
            <i class="bi bi-plus me-1"></i>Добавить утверждение
        </button>

        <button class="btn btn-success mt-2 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const statementsWrapper = card.querySelector(".truefalse-statements");
    const addBtn = card.querySelector(".add-statement-btn");
    const saveBtn = card.querySelector(".save-btn");
    const removeBtn = card.querySelector(".remove-task-btn");

    addBtn.addEventListener("click", () => {
            addTrueFalseStatement(statementsWrapper);
    });

    removeBtn.addEventListener("click", () => card.remove());

    if (Array.isArray(taskData?.statements) && taskData.statements.length > 0) {
        taskData.statements.forEach(item => {
            addTrueFalseStatement(
                statementsWrapper,
                escapeHtml(item.statement),
                item.is_true ? "true" : "false"
            );
        });
    } else {
        for (let i = 0; i < 2; i++) {
            addTrueFalseStatement(statementsWrapper);
        }
    }

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}

/**
 * Добавляет строку утверждения True / False.
 *
 * @param {HTMLElement} container
 * @param {string} textValue
 * @param {"true"|"false"} value
 */
export function addTrueFalseStatement(container, textValue = "", value = "false") {
    const sId = generateId("statement");

    const row = document.createElement("div");
    row.className = "statement-row d-flex align-items-center gap-2 mb-2";
    row.dataset.statementId = sId;

    row.innerHTML = `
        <select class="form-select statement-select" style="width: 120px;">
            <option value="true" ${value === "true" ? "selected" : ""}>Правда</option>
            <option value="false" ${value === "false" ? "selected" : ""}>Ложь</option>
        </select>

        <input
            type="text"
            class="form-control statement-text"
            placeholder="Утверждение"
            value="${textValue}">

        <button
            class="btn-close remove-statement-btn"
            title="Удалить утверждение"
            style="transform: scale(0.7);"></button>
    `;

    row.querySelector(".remove-statement-btn")
        .addEventListener("click", () => row.remove());

    container.appendChild(row);
    row.querySelector(".statement-text").focus();
}

/**
 * Собирает данные True / False задания из DOM-карточки.
 *
 * @param {HTMLElement} card
 * @returns {Array<{statement: string, is_true: boolean}>}
 */
export function collectTrueFalseData(card) {
    const statements = [];
    const rows = card.querySelectorAll(".statement-row");

    rows.forEach(row => {
        const textInput = row.querySelector(".statement-text");
        const select = row.querySelector(".statement-select");

        if (textInput.value.trim()) {
            statements.push({
                statement: textInput.value.trim(),
                is_true: select.value === "true"
            });
        }
    });

    return statements;
}
