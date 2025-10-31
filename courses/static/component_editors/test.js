function renderTestTaskEditor(nextTaskId = null) {
    const taskList = document.getElementById("task-list");
    if (!taskList) return;

    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border rounded";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Тест</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="questions-wrapper"></div>

        <button class="btn btn-link text-primary fw-semibold mt-3 add-question-btn px-0" style="border:none;">
            <i class="bi bi-plus me-1"></i>Добавить вопрос
        </button>

        <button class="btn btn-success mt-2 w-100 fw-semibold">
            Сохранить
        </button>
    `;

    const questionsWrapper = card.querySelector(".questions-wrapper");

    card.querySelector(".add-question-btn")
        .addEventListener("click", () => addNewQuestion(questionsWrapper));

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => card.remove());

    card.querySelector(".btn-success")
        .addEventListener("click", () => saveTask("test", card));

    addNewQuestion(questionsWrapper);

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

function addNewQuestion(wrapper) {
    const qId = generateId("question");

    const block = document.createElement("div");
    block.className = "question-container mb-4 p-0 p-lg-3 border-0";
    block.dataset.questionId = qId;

    block.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <input type="text" class="form-control question-text" placeholder="Вопрос">
            <button class="btn-close remove-question-btn small ms-1" type="button" title="Удалить вопрос"></button>
        </div>

        <div class="answers-container mb-2"></div>

        <button class="btn border-0 add-answer-btn text-secondary px-0" type="button" title="Добавить вариант">
            <i class="bi bi-plus me-1"></i>Добавить вариант
        </button>
    `;

    const answersContainer = block.querySelector(".answers-container");

    block.querySelector(".remove-question-btn")
        .addEventListener("click", () => block.remove());

    block.querySelector(".add-answer-btn")
        .addEventListener("click", () => addAnswer(answersContainer, qId));

    for (let i = 0; i < 3; i++) addAnswer(answersContainer, qId);

    wrapper.appendChild(block);
    block.querySelector(".question-text").focus();
}

function addAnswer(container, questionId) {
    const aId = generateId("answer");

    const row = document.createElement("div");
    row.className = "answer-row mb-2 d-flex align-items-center me-4 ms-2";

    row.innerHTML = `
        <input type="checkbox"
               class="form-check-input correct-answer-checkbox me-3 mb-1"
               style="transform: scale(1.5);"
               id="correct-${questionId}-${aId}"
               autocomplete="off">
        <input type="text"
               class="form-control answer-text"
               placeholder="Ответ">
        <button class="btn-close remove-answer-btn ms-2 small"
                style="transform: scale(0.75);"
                type="button"
                title="Удалить вариант"></button>
    `;

    row.querySelector(".remove-answer-btn")
        .addEventListener("click", () => row.remove());

    container.appendChild(row);
}
