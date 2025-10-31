function renderFillGapsTaskEditor(nextTaskId = null) {
    const taskList = document.getElementById("task-list");
    if (!taskList) return;

    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border rounded";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Заполни пропуски</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="mb-3">
            <label class="form-label mb-1">Тип задания</label>
            <select class="form-select fill-type-select w-auto">
                <option value="open" selected>Cо списком слов</option>
                <option value="hidden">Без списка</option>
            </select>
        </div>

        <div class="mb-3">
            <label class="form-label mb-1">Текст с пропусками</label>
            <textarea class="form-control fill-text-input" rows="4"
                      placeholder="Введите текст, например: She has lived in [London] for [five] years."></textarea>
        </div>

        <button class="btn btn-success mt-2 w-100 fw-semibold">
            Сохранить
        </button>
    `;

    // удаление карточки
    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => card.remove());

    // сохранение
    card.querySelector(".btn-success")
        .addEventListener("click", () => saveTask("fill_gaps", card));

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


function extractAnswersFromText(text) {
    // Ищем все подстроки внутри квадратных скобок
    const matches = [...text.matchAll(/\[([^\]]+)\]/g)];
    return matches.map(m => m[1].trim()).filter(Boolean);
}




