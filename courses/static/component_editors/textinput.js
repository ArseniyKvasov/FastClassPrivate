function renderTextInputTaskEditor(nextTaskId = null) {
    const taskList = document.getElementById("task-list");
    if (!taskList) return;

    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border rounded";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Текстовое задание</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="mb-2">
            <input type="text" class="form-control task-prompt" placeholder="Введите заголовок">
        </div>

        <div class="mb-2">
            <textarea class="form-control task-default-text" rows="3" placeholder="Текст по умолчанию (опционально)"></textarea>
        </div>

        <button class="btn btn-success mt-3 w-100 fw-semibold">
            Сохранить
        </button>
    `;

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => card.remove());

    card.querySelector(".btn-success")
        .addEventListener("click", () => saveTask("text_input", card));

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
