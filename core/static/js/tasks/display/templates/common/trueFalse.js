/**
 * Рендерит задачу True/False и форму для каждого утверждения.
 *
 * task: {
 *     id: string,
 *     statements: [{ statement: string, is_true: boolean }]
 * }
 */
export function renderTrueFalseTask(task, container) {
    if (!container) return;
    container.innerHTML = "";

    if (!Array.isArray(task.data.statements) || !task.data.statements.length) {
        const empty = document.createElement("div");
        empty.className = "text-danger";
        empty.textContent = "Нет утверждений для отображения.";
        container.appendChild(empty);
        return;
    }

    task.data.statements.forEach((stmt, sIndex) => {
        const statementDiv = document.createElement("div");
        statementDiv.className = "tf-statement mb-2 fw-semibold";
        statementDiv.textContent = stmt.statement;
        container.appendChild(statementDiv);

        const form = document.createElement("form");
        form.className = "d-flex gap-3 mb-3";
        form.dataset.statementIndex = String(sIndex);

        ["true", "false"].forEach(val => {
            const optionDiv = document.createElement("div");
            optionDiv.className = "form-check";

            const input = document.createElement("input");
            input.type = "radio";
            input.name = `tf-${task.task_id}-s${sIndex}`;
            input.className = "form-check-input";
            input.dataset.tf = val;
            input.dataset.statementIndex = String(sIndex);
            input.id = `tf-${task.task_id}-s${sIndex}-${val}`;

            const label = document.createElement("label");
            label.className = "form-check-label";
            label.htmlFor = input.id;
            label.textContent = val === "true" ? "Правда" : "Ложь";

            optionDiv.appendChild(input);
            optionDiv.appendChild(label);
            form.appendChild(optionDiv);
        });

        container.appendChild(form);
    });

    const checkBtn = document.createElement("button");
    checkBtn.type = "button";
    checkBtn.className = "btn btn-primary mt-3 check-task-btn";
    checkBtn.textContent = "Проверить";
    checkBtn.style.display = "none";
    container.appendChild(checkBtn);
}
