export function renderTrueFalseTask(task, container) {
    if (!container) return;
    container.innerHTML = "";

    // Уникальный идентификатор для группы радиокнопок
    const taskId = task.id ?? Math.floor(Math.random() * 100000);

    // Утверждение
    const statementDiv = document.createElement("div");
    statementDiv.className = "tf-statement mb-3 fw-semibold";
    statementDiv.textContent = task.statement;
    container.appendChild(statementDiv);

    // Контейнер для радиокнопок
    const form = document.createElement("form");
    form.className = "d-flex gap-3";

    ["Правда", "Ложь"].forEach((text, index) => {
        const optionDiv = document.createElement("div");
        optionDiv.className = "form-check";

        const input = document.createElement("input");
        input.type = "radio";
        input.name = `tf-${taskId}`; // уникальная группа
        input.id = `tf-${taskId}-${index}`;
        input.className = "form-check-input";
        input.value = text;

        // Установка состояния по task.is_true
        if (task.hasOwnProperty("is_true")) {
            input.checked = (text === "Правда" && task.is_true) || (text === "Ложь" && !task.is_true);
        }

        input.onchange = () => {
            task.selected = text; // сохраняем выбор
        };

        const label = document.createElement("label");
        label.className = "form-check-label";
        label.htmlFor = input.id;
        label.textContent = text;

        optionDiv.appendChild(input);
        optionDiv.appendChild(label);
        form.appendChild(optionDiv);
    });

    container.appendChild(form);
}
