export function renderTestTask(task, container) {
    if (!container) return;
    container.innerHTML = "";

    // Вопрос
    const questionDiv = document.createElement("div");
    questionDiv.className = "test-question fw-semibold mb-3";
    questionDiv.textContent = task.question;
    container.appendChild(questionDiv);

    // Варианты
    if (Array.isArray(task.options) && task.options.length) {
        const form = document.createElement("form");
        form.className = "test-options";

        task.options.forEach((option, index) => {
            const optionDiv = document.createElement("div");
            optionDiv.className = "form-check mb-2";

            const input = document.createElement("input");
            input.className = "form-check-input";
            input.type = "radio";
            input.name = `test-option-${task.id || 0}`; // уникальное имя для группы
            input.id = `test-option-${task.id || 0}-${index}`;
            input.value = option.option;

            const label = document.createElement("label");
            label.className = "form-check-label";
            label.htmlFor = input.id;
            label.textContent = option.option;

            optionDiv.appendChild(input);
            optionDiv.appendChild(label);
            form.appendChild(optionDiv);
        });

        container.appendChild(form);
    } else {
        const empty = document.createElement("div");
        empty.className = "text-danger";
        empty.textContent = "Нет вариантов ответа.";
        container.appendChild(empty);
    }
}
