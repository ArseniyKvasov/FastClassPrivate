import { debounce, adjustTextareaHeight } from "/static/classroom/answers/utils.js";
import { sendAnswer } from "/static/classroom/answers/api.js";

/**
 * Навешивает обработчик на текстовое поле / textarea
 * @param {HTMLElement} container
 * @param {Object} task
 */
export function bindAnswerSubmission(container, task) {
    if (!container) return;

    const input = container.querySelector("textarea, input[type='text']");
    if (!input) return;

    const syncValue = (value) => {
        if (input.value !== value) {
            input.value = value;
            if (input.tagName.toLowerCase() === "textarea") {
                adjustTextareaHeight(input);
            }
        }
    };

    input.addEventListener("input", debounce(() => {
        sendAnswer({
            taskId: task.task_id,
            data: { current_text: input.value }
        });
    }, 400));
}

export async function handleAnswer(data) {
    /**
     * Обрабатывает ответ на задание с текстовым вводом
     * @param {Object} data - Данные ответа
     * @param {string} data.task_id - ID задания
     * @param {string} data.task_type - Тип задания (должен быть "text_input")
     * @param {Object} data.answer - Данные ответа
     * @param {string} data.answer.current_text - Текст ответа
     * @param {boolean} data.answer.is_checked - Проверен ли ответ
     */
    try {
        if (!data || data.task_type !== "text_input") return;

        const serverText = data.answer?.current_text ?? "";
        const isChecked = data.answer?.is_checked ?? false;

        const container = document.querySelector(`[data-task-id="${data.task_id}"]`);
        if (!container) return;

        const textarea = container.querySelector("textarea, input[type='text']");
        if (!textarea) return;

        if (textarea.value !== serverText) {
            textarea.value = serverText;
            if (textarea.tagName.toLowerCase() === "textarea") {
                adjustTextareaHeight(textarea);
            }
        }

        textarea.disabled = isChecked;
        textarea.readOnly = isChecked;
    } catch (error) {
        console.error(`Ошибка в handleTextInputAnswer для task ${data.task_id}:`, error);
        showNotification("Не удалось отобразить ответ.");
    }
}

export function clearTask(container) {
    const textarea = container.querySelector("textarea, input[type='text']");
    if (!textarea) return;

    textarea.value = "";
    textarea.readOnly = false;
    textarea.disabled = false;
}