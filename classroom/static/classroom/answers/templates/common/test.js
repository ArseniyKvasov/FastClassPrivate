import { getIsPreview, showNotification } from "js/tasks/utils.js";
import { sendAnswer } from "classroom/answers/api.js";
import { initCheckButton } from "classroom/answers/utils.js";

/**
 * Собирает ответы для задания test из контейнера
 * @param {Object} task
 * @param {HTMLElement} container
 * @returns {Array} answers
 */
export function collectAnswers(task, container) {
    const answers = [];
    if (!container || !task) return answers;

    // Находим формы каждого вопроса
    const forms = container.querySelectorAll('form[data-question-index]');
    forms.forEach(form => {
        const qIndex = Number(form.dataset.questionIndex);
        const selected = form.querySelector('input[type="radio"]:checked');
        answers.push({
            question_index: qIndex,
            selected_option: selected ? Number(selected.dataset.optionIndex) : null
        });
    });

    return answers;
}

/**
 * Навешивает обработчики на элементы с вариантами ответа для test
 * @param {HTMLElement} container
 * @param {Object} task
 */
export function bindAnswerSubmission(container, task) {
    if (!container) return;

    container.querySelectorAll('input[type="radio"]').forEach(input => {
        input.addEventListener("change", () => {
            if (getIsPreview()) {
                showNotification("Нажмите Выбрать чтобы отправить ответ");
                input.checked = false;
                return;
            }

            const answers = collectAnswers(task, container);
            sendAnswer({
                taskId: task.task_id,
                data: { answers }
            });
        });
    });
}

export async function handleAnswer(data) {
    /**
     * Обрабатывает ответ на тестовое задание
     * @param {Object} data - Данные ответа
     * @param {string} data.task_id - ID задания
     * @param {string} data.task_type - Тип задания (должен быть "test")
     * @param {Object} data.answer - Данные ответа
     * @param {Array} data.answer.answers - Массив ответов на вопросы
     * @param {number} data.answer.answers[].question_index - Индекс вопроса
     * @param {number} data.answer.answers[].selected_option - Выбранный вариант
     * @param {boolean} data.answer.answers[].is_correct - Правильность ответа
     * @param {boolean} data.answer.is_checked - Проверен ли ответ
     */
    try {
        if (!data || data.task_type !== "test") return;

        const answers = data.answer?.answers || [];
        const isChecked = data.answer?.is_checked ?? false;

        const container = document.querySelector(`[data-task-id="${data.task_id}"]`);
        if (!container) return;

        container.dataset.isChecked = isChecked.toString();

        container.querySelectorAll("[data-option-index]").forEach(el => {
            const qIndex = Number(el.dataset.questionIndex);
            const oIndex = Number(el.dataset.optionIndex);

            const answerForQ = answers.find(a => a.question_index === qIndex) || {};
            const selectedIdx = answerForQ.selected_option;
            const correct = answerForQ.is_correct;
            const isSelected = selectedIdx === oIndex;

            if (el.tagName.toLowerCase() === "input" && el.type === "radio") {
                el.checked = isSelected;
            }

            if (isChecked) {
                el.disabled = true;
                el.classList.remove("bg-success", "bg-danger", "text-white", "fw-bold");

                if (isSelected) {
                    if (correct) {
                        el.classList.add("bg-success", "text-white", "fw-bold");
                        if (el.tagName.toLowerCase() === "input" && el.type === "radio") {
                            el.style.border = "none";
                            el.style.outline = "none";
                            el.style.borderColor = "#198754";
                            el.style.boxShadow = "none";
                        }
                    } else {
                        el.classList.add("bg-danger", "text-white");
                        if (el.tagName.toLowerCase() === "input" && el.type === "radio") {
                            el.style.border = "none";
                            el.style.outline = "none";
                            el.style.borderColor = "#dc3545";
                            el.style.boxShadow = "none";
                        }
                    }
                } else {
                    if (el.tagName.toLowerCase() === "input" && el.type === "radio") {
                        el.style.border = "";
                        el.style.outline = "";
                        el.style.borderColor = "";
                        el.style.boxShadow = "";
                    }
                }
            } else {
                el.disabled = false;
                el.classList.remove("bg-success", "bg-danger", "text-white", "fw-bold");
                if (el.tagName.toLowerCase() === "input" && el.type === "radio") {
                    el.style.border = "";
                    el.style.outline = "";
                    el.style.borderColor = "";
                    el.style.boxShadow = "";
                }
            }
        });

        const checkBtn = container.querySelector("button.btn-primary");
        if (checkBtn) {
            checkBtn.style.display = isChecked ? "none" : "";
        }

        try {
            initCheckButton(data, container);
        } catch (err) {
            console.error("Не удалось инициализировать кнопку checkButton: ", err);
        }
    } catch (error) {
        console.error(`Ошибка в handleTestAnswer для task ${data.task_id}:`, error);
        showNotification("Не удалось отобразить ответ.");
    }
}

export function clearTask(container) {
    container.dataset.isChecked = "false";

    container.querySelectorAll("[data-option-index]").forEach(el => {
        el.checked = false;
        el.disabled = false;
        el.classList.remove("bg-success", "bg-danger", "text-white", "fw-bold");
        el.style.border = "";
        el.style.outline = "";
        el.style.borderColor = "";
        el.style.boxShadow = "";
    });

    const btn = container.querySelector("button.btn-primary");
    if (btn) btn.style.display = "";
}