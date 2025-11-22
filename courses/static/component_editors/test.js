/**
 * Рендер редактора задания теста.
 * Если передан taskId — открывает модальное окно для редактирования.
 * taskData может содержать массив questions с options.
 */
function renderTestTaskEditor(taskId = null, container = null, taskData = null) {
    console.log(taskData);
    const parent = container || document.getElementById("task-list");
    if (!parent) return;

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
    addQuestionBtn.addEventListener("click", () => addNewQuestion(questionsWrapper));

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => {
            if (taskId && bootstrapEditorModal) {
                bootstrapEditorModal.hide();
            } else {
                card.remove();
            }
        });

    card.querySelector(".btn-success")
        .addEventListener("click", () => saveTask("test", card, taskId));

    if (taskData?.questions?.length) {
        taskData.questions.forEach(questionData => {
            addNewQuestion(questionsWrapper, questionData);
        });
    } else {
        addNewQuestion(questionsWrapper);
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

function addNewQuestion(wrapper, qData = null) {
    const qId = generateId("question");

    const questionText = qData?.question || "";

    const block = document.createElement("div");
    block.className = "question-container mb-4 p-0 p-lg-3 border-0";
    block.dataset.questionId = qId;

    block.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <input type="text" class="form-control question-text" placeholder="Вопрос" value="${questionText}">
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

    if (qData?.options?.length) {
        qData.options.forEach(o => addAnswer(answersContainer, qId, { text: o.option, is_correct: o.is_correct }));
    } else {
        for (let i = 0; i < 3; i++) addAnswer(answersContainer, qId);
    }

    wrapper.appendChild(block);
    block.querySelector(".question-text").focus();
}

function addAnswer(container, questionId, answerData = null) {
    const aId = generateId("answer");

    const isChecked = answerData?.is_correct ? "checked" : "";
    const textValue = answerData?.text || "";

    const row = document.createElement("div");
    row.className = "answer-row mb-2 d-flex align-items-center me-4 ms-2";

    row.innerHTML = `
        <input type="checkbox"
               class="form-check-input correct-answer-checkbox me-3 mb-1"
               style="transform: scale(1.5);"
               id="correct-${questionId}-${aId}"
               autocomplete="off" ${isChecked}>
        <input type="text"
               class="form-control answer-text"
               placeholder="Ответ"
               value="${textValue}">
        <button class="btn-close remove-answer-btn ms-2 small"
                style="transform: scale(0.75);"
                type="button"
                title="Удалить вариант"></button>
    `;

    row.querySelector(".remove-answer-btn")
        .addEventListener("click", () => row.remove());

    container.appendChild(row);
}