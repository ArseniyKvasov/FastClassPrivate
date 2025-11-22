/**
 * Рендер редактора задания True / False.
 * Если передан taskId — открывает модальное окно для редактирования.
 * taskData может содержать массив утверждений [{statement: "...", is_true: bool}, ...]
 */
function renderTrueFalseTaskEditor(taskId = null, container = null, taskData = null) {
    console.log(taskData);
    const parent = container || document.getElementById("task-list");
    if (!parent) return;

    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Правда или ложь</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div id="truefalse-statements" class="mb-3"></div>

        <button class="btn btn-link text-primary fw-semibold mt-3 add-statement-btn px-0" style="border:none;">
            <i class="bi bi-plus me-1"></i>Добавить утверждение
        </button>

        <button class="btn btn-success mt-2 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const statementsWrapper = card.querySelector("#truefalse-statements");

    const addBtn = card.querySelector(".add-statement-btn");

    if (taskId) {
        addBtn.style.display = "none";
    } else {
        addBtn.addEventListener("click", () => addTrueFalseStatement(statementsWrapper));
    }

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => {
            if (taskId && bootstrapEditorModal) {
                bootstrapEditorModal.hide();
            } else {
                card.remove();
            }
        });

    card.querySelector(".btn-success")
        .addEventListener("click", () => saveTask("true_false", card, taskId));

    if (taskData && Array.isArray(taskData.statements) && taskData.statements.length > 0) {
        taskData.statements.forEach(statement => {
            addTrueFalseStatement(
                statementsWrapper,
                statement.statement,
                statement.is_true.toString()
            );
        });
    } else {
        for (let i = 0; i < 2; i++) addTrueFalseStatement(statementsWrapper);
    }

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

function addTrueFalseStatement(container, textValue = "", value = "false") {
    const sId = generateId("statement");

    const row = document.createElement("div");
    row.className = "statement-row d-flex align-items-center gap-2 mb-2";
    row.dataset.statementId = sId;

    row.innerHTML = `
        <select class="form-select statement-select" style="width: 120px;">
            <option value="true" ${value === "true" ? "selected" : ""}>Правда</option>
            <option value="false" ${value === "false" ? "selected" : ""}>Ложь</option>
        </select>
        <input type="text" class="form-control statement-text" placeholder="Утверждение" value="${textValue}">
        <button class="btn-close remove-statement-btn" title="Удалить утверждение" style="transform: scale(0.7);"></button>
    `;

    row.querySelector(".remove-statement-btn")
        .addEventListener("click", () => row.remove());

    container.appendChild(row);
    row.querySelector(".statement-text").focus();
}

function collectTrueFalseData(card) {
    const statements = [];
    const statementRows = card.querySelectorAll('.statement-row');

    statementRows.forEach(row => {
        const textInput = row.querySelector('.statement-text');
        const select = row.querySelector('.statement-select');

        if (textInput.value.trim()) {
            statements.push({
                statement: textInput.value.trim(),
                is_true: select.value === "true"
            });
        }
    });

    return statements;
}