import { showNotification, escapeHtml, generateId } from "/static/js/tasks/utils.js";

/**
 * Рендерит редактор задания типа «Тест».
 *
 * Позволяет создавать вопросы с вариантами ответов,
 * отмечать правильные варианты и редактировать существующие данные.
 *
 * @param {{questions?: Array}} taskData
 */
export function renderTestTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Тест</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="questions-wrapper"></div>

        <button class="btn btn-link text-primary fw-semibold mt-3 add-question-btn px-0" style="border:none;">
            <i class="bi bi-plus me-1"></i>Добавить вопрос
        </button>

        <button class="btn btn-success mt-2 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const questionsWrapper = card.querySelector(".questions-wrapper");
    const addQuestionBtn = card.querySelector(".add-question-btn");
    const saveBtn = card.querySelector(".save-btn");
    const removeTaskBtn = card.querySelector(".remove-task-btn");

    addQuestionBtn.addEventListener("click", () => addNewQuestion(questionsWrapper));

    removeTaskBtn.addEventListener("click", () => card.remove());

    const initialQuestions = Array.isArray(taskData?.questions) ? taskData.questions : [];
    if (initialQuestions.length) {
        initialQuestions.forEach(q => addNewQuestion(questionsWrapper, q));
    } else {
        addNewQuestion(questionsWrapper);
    }

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}

/**
 * Добавляет новый вопрос в редактор теста.
 *
 * Создаёт поле вопроса и набор вариантов ответов.
 *
 * @param {HTMLElement} wrapper
 * @param {{question?: string, options?: Array}|null} qData
 */
export function addNewQuestion(wrapper, qData = null) {
    const qId = generateId("question");
    const questionText = qData?.question || "";

    const block = document.createElement("div");
    block.className = "question-container mb-4 p-0 p-lg-3 border-0";
    block.dataset.questionId = qId;

    block.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <input type="text"
                   class="form-control question-text"
                   placeholder="Вопрос"
                   value="${escapeHtml(questionText)}">
            <button class="btn-close remove-question-btn small ms-1"
                    type="button"
                    title="Удалить вопрос"></button>
        </div>

        <div class="answers-container mb-2"></div>

        <button class="btn border-0 add-answer-btn text-secondary px-0"
                type="button"
                title="Добавить вариант">
            <i class="bi bi-plus me-1"></i>Добавить вариант
        </button>
    `;

    const answersContainer = block.querySelector(".answers-container");

    block.querySelector(".remove-question-btn")
        .addEventListener("click", () => block.remove());

    block.querySelector(".add-answer-btn")
        .addEventListener("click", () => {
            addAnswer(answersContainer, qId);
        });

    if (Array.isArray(qData?.options) && qData.options.length) {
        qData.options.forEach(o => {
            addAnswer(answersContainer, qId, {
                text: o.option,
                is_correct: !!o.is_correct
            });
        });
    } else {
        for (let i = 0; i < 3; i++) addAnswer(answersContainer, qId);
    }

    wrapper.appendChild(block);
    const firstInput = block.querySelector(".question-text");
    if (firstInput) firstInput.focus();
}

/**
 * Добавляет вариант ответа к вопросу.
 *
 * Поддерживает отметку правильного ответа и удаление варианта.
 *
 * @param {HTMLElement} container
 * @param {string} questionId
 * @param {{text?: string, is_correct?: boolean}|null} answerData
 */
export function addAnswer(container, questionId, answerData = null) {
    const aId = generateId("answer");
    const isChecked = answerData?.is_correct ? "checked" : "";
    const textValue = answerData?.text || "";

    const row = document.createElement("div");
    row.className = "answer-row mb-2 d-flex align-items-center me-4 ms-2";

    // use unique id for label-checkbox pairing
    const checkboxId = `correct-${questionId}-${aId}`;

    row.innerHTML = `
        <input type="checkbox"
               class="form-check-input correct-answer-checkbox me-3 mb-1"
               style="transform: scale(1.5);"
               id="${checkboxId}"
               autocomplete="off"
               ${isChecked}>
        <input type="text"
               class="form-control answer-text"
               placeholder="Ответ"
               value="${escapeHtml(textValue)}">
        <button class="btn-close remove-answer-btn ms-2 small"
                style="transform: scale(0.75);"
                type="button"
                title="Удалить вариант"></button>
    `;

    row.querySelector(".remove-answer-btn")
        .addEventListener("click", () => row.remove());

    container.appendChild(row);
}

