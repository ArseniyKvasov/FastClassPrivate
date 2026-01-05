import { sendAnswer } from "@classroom/answers/api.js";
import { initCheckButton } from "@classroom/answers/utils.js";

/**
 * Собирает ответы из контейнера для true/false задания
 * @param {Object} task
 * @param {HTMLElement} container
 * @returns {Array} answers
 */
export function collectAnswers(task, container) {
    const answers = [];
    if (!container || !task) return answers;

    // Каждое утверждение в форме
    const forms = container.querySelectorAll('form[data-statement-index]');
    forms.forEach(form => {
        const sIndex = Number(form.dataset.statementIndex);
        const selected = form.querySelector('input[type="radio"]:checked');
        answers.push({
            statement_index: sIndex,
            selected_value: selected ? (selected.dataset.tf === 'true') : null
        });
    });

    return answers;
}

/**
 * Навешивает обработчики на элементы задания true/false
 * @param {HTMLElement} container
 * @param {Object} task
 */
export function bindAnswerSubmission(container, task) {
    if (!container) return;

    container.querySelectorAll('input[type="radio"]').forEach(input => {
        input.addEventListener("change", () => {
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
     * Обрабатывает ответ на задание true/false
     * @param {Object} data - Данные ответа
     * @param {string} data.task_id - ID задания
     * @param {string} data.task_type - Тип задания (должен быть "true_false")
     * @param {Object} data.answer - Данные ответа
     * @param {Array} data.answer.answers - Массив ответов на утверждения
     * @param {number} data.answer.answers[].statement_index - Индекс утверждения
     * @param {boolean} data.answer.answers[].selected_value - Выбранное значение
     * @param {boolean} data.answer.answers[].is_correct - Правильность ответа
     * @param {boolean} data.answer.is_checked - Проверен ли ответ
     */
    try {
        if (!data || data.task_type !== "true_false") return;

        const answers = data.answer?.answers || [];
        const isChecked = data.answer?.is_checked ?? false;

        const container = document.querySelector(`[data-task-id="${data.task_id}"]`);
        if (!container) return;

        container.dataset.isChecked = isChecked.toString();

        container.querySelectorAll("[data-tf]").forEach(el => {
            const sIndex = Number(el.dataset.statementIndex);
            const answerForS = answers.find(a => a.statement_index === sIndex) || {};
            const selectedValue = answerForS.selected_value;
            const correct = answerForS.is_correct;

            const tf = el.dataset.tf === "true";
            const isSelected = selectedValue !== null && tf === selectedValue;

            if (isChecked) {
                el.disabled = true;
                el.readOnly = true;

                if (isSelected) {
                    if (correct) {
                        el.classList.remove("bg-danger");
                        el.classList.add("bg-success", "text-white", "fw-bold");
                        if (el.tagName.toLowerCase() === "input") {
                            el.style.border = "none";
                            el.style.outline = "none";
                            el.style.borderColor = "#198754";
                            el.style.boxShadow = "none";
                        }
                    } else {
                        el.classList.remove("bg-success", "fw-bold");
                        el.classList.add("bg-danger", "text-white");
                        if (el.tagName.toLowerCase() === "input") {
                            el.style.border = "none";
                            el.style.outline = "none";
                            el.style.borderColor = "#dc3545";
                            el.style.boxShadow = "none";
                        }
                    }
                } else {
                    el.classList.remove("bg-success", "bg-danger", "text-white", "fw-bold");
                    if (el.tagName.toLowerCase() === "input") {
                        el.style.border = "";
                        el.style.outline = "";
                        el.style.borderColor = "";
                        el.style.boxShadow = "";
                    }
                }
            } else {
                el.disabled = false;
                el.readOnly = false;
                el.classList.remove("bg-success", "bg-danger", "text-white", "fw-bold");
                if (el.tagName.toLowerCase() === "input") {
                    el.style.border = "";
                    el.style.outline = "";
                    el.style.borderColor = "";
                    el.style.boxShadow = "";
                }
            }

            if (el.tagName.toLowerCase() === "input" && (el.type === "radio" || el.type === "checkbox")) {
                el.checked = isSelected;
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
        console.error(`Ошибка в handleTrueFalseAnswer для task ${data.task_id}:`, error);
        showNotification("Не удалось отобразить ответ.");
    }
}

export function clearTask(container) {
    container.dataset.isChecked = "false";

    container.querySelectorAll("[data-tf]").forEach(el => {
        el.checked = false;
        el.disabled = false;
        el.readOnly = false;
        el.classList.remove("bg-success", "bg-danger", "text-white", "fw-bold");
        el.style.border = "";
        el.style.outline = "";
        el.style.borderColor = "";
        el.style.boxShadow = "";
    });

    const btn = container.querySelector("button.btn-primary");
    if (btn) btn.style.display = "";
}