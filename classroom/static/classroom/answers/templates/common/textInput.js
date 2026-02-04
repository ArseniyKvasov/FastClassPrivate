import { debounce, adjustTextareaHeight } from "/static/classroom/answers/utils.js";
import { sendAnswer } from "/static/classroom/answers/api.js";

let isApplyingServerUpdate = false;

/**
 * Навешивает обработчик на текстовое поле / textarea
 * @param {HTMLElement} container - Контейнер с заданием
 * @param {Object} task - Объект задания
 */
export function bindAnswerSubmission(container, task) {
    if (!container) return;

    const input = container.querySelector("textarea, input[type='text']");
    if (!input) return;

    input.addEventListener("input", debounce(() => {
        if (isApplyingServerUpdate) return;

        sendAnswer({
            taskId: task.task_id,
            data: { current_text: input.value }
        });
    }, 400));
}

/**
 * Обрабатывает ответ на задание с текстовым вводом
 * @param {Object} data - Данные ответа
 * @returns {Promise<void>}
 */
export async function handleAnswer(data) {
    if (!data || data.task_type !== "text_input") return;

    const taskId = data.task_id;
    const serverText = data.answer?.current_text ?? "";
    const isChecked = data.answer?.is_checked ?? false;

    const container = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!container) return;

    const textarea = container.querySelector("textarea, input[type='text']");
    if (!textarea) return;

    const currentText = textarea.value;

    if (currentText === serverText) {
        textarea.disabled = isChecked;
        textarea.readOnly = isChecked;
        return;
    }

    isApplyingServerUpdate = true;

    try {
        const cursorPosition = textarea.selectionStart;
        const userIsTyping = document.activeElement === textarea;

        if (userIsTyping && cursorPosition > 0) {
            const prefix = currentText.substring(0, cursorPosition);
            const serverPrefix = serverText.substring(0, cursorPosition);

            if (prefix !== serverPrefix) {
                isApplyingServerUpdate = false;
                return;
            }
        }

        textarea.value = serverText;

        if (textarea.tagName.toLowerCase() === "textarea") {
            adjustTextareaHeight(textarea);
        }

        if (userIsTyping) {
            const newPosition = Math.min(cursorPosition, serverText.length);
            requestAnimationFrame(() => {
                textarea.setSelectionRange(newPosition, newPosition);
            });
        }

        textarea.disabled = isChecked;
        textarea.readOnly = isChecked;

    } finally {
        setTimeout(() => {
            isApplyingServerUpdate = false;
        }, 50);
    }
}

/**
 * Очищает поле ввода задания
 * @param {HTMLElement} container - Контейнер с заданием
 */
export function clearTask(container) {
    const textarea = container.querySelector("textarea, input[type='text']");
    if (!textarea) return;

    textarea.value = "";
    textarea.readOnly = false;
    textarea.disabled = false;

    if (textarea.tagName.toLowerCase() === "textarea") {
        adjustTextareaHeight(textarea);
    }
}