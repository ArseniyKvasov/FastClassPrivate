function renderTrueFalseTaskEditor(nextTaskId = null) {
    const taskList = document.getElementById("task-list");
    if (!taskList) return;

    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border rounded";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">True / False</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div id="truefalse-statements" class="mb-3"></div>

        <button class="btn btn-link text-primary fw-semibold mt-3 add-statement-btn px-0" style="border:none;">
            <i class="bi bi-plus me-1"></i>Добавить утверждение
        </button>

        <button class="btn btn-success mt-2 w-100 fw-semibold">
            Сохранить
        </button>
    `;

    const statementsWrapper = card.querySelector("#truefalse-statements");

    card.querySelector(".add-statement-btn")
        .addEventListener("click", () => addTrueFalseStatement(statementsWrapper));

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => card.remove());

    card.querySelector(".btn-success")
        .addEventListener("click", () => saveTask("true_false", card));

    for (let i = 0; i < 2; i++) addTrueFalseStatement(statementsWrapper);

    if (nextTaskId) {
        const nextEl = document.querySelector(`[data-task-id="${nextTaskId}"]`);
        if (nextEl) {
            taskList.insertBefore(card, nextEl);
            return;
        }
    }

    taskList.appendChild(card);
    card.scrollIntoView({ behavior: "smooth", block: "center" });
}

function addTrueFalseStatement(container) {
    const sId = generateId("statement");

    const row = document.createElement("div");
    row.className = "statement-row d-flex align-items-center gap-2 mb-2";
    row.dataset.statementId = sId;

    row.innerHTML = `
        <select class="form-select statement-select" style="width: 120px;">
            <option value="true">Правда</option>
            <option value="false" selected>Ложь</option>
        </select>
        <input type="text" class="form-control statement-text" placeholder="Утверждение" value="">
        <button class="btn-close remove-statement-btn" title="Удалить утверждение" style="transform: scale(0.7);"></button>
    `;

    row.querySelector(".remove-statement-btn")
        .addEventListener("click", () => row.remove());

    container.appendChild(row);
    row.querySelector(".statement-text").focus();
}