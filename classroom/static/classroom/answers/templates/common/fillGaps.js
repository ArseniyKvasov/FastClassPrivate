import { sendAnswer } from "@classroom/answers/api.js";
import { updateBadgesStrikethrough } from "@classroom/answers/utils.js";

/**
 * Навешивает обработчики на поля задания fill-gaps
 * @param {HTMLElement} container
 * @param {Object} task
 */
export function bindAnswerSubmission(container, task) {
    if (!container) return;

    const inputs = container.querySelectorAll(".gap-input");

    inputs.forEach((input, index) => {
        input.addEventListener("blur", () => {
            const value = input.value.trim();
            if (!value) return;

            sendAnswer({
                taskId: task.task_id,
                data: { [`gap-${index}`]: value }
            });
        });
    });
}

export async function handleAnswer(data) {
    try {
        if (!data || data.task_type !== "fill_gaps") return;

        const answers = data.answer?.answers ?? {};

        const container = document.querySelector(`[data-task-id="${data.task_id}"]`);
        if (!container) return;

        updateBadgesStrikethrough(container, answers);

        container.querySelectorAll(".gap-input").forEach((input, index) => {
            const answerData = answers[index];
            const serverValue = answerData?.value || "";
            const isCorrect = answerData?.is_correct;
            const currentIsCorrect = input.classList.contains("bg-success");
            const currentIsWrong = input.classList.contains("bg-danger");

            if (input.value !== serverValue) {
                input.value = serverValue;
            }

            if (!serverValue.trim()) {
                input.classList.remove("bg-success", "bg-danger", "bg-opacity-25", "border", "border-success", "border-danger", "text-white");
                input.disabled = false;
                input.readOnly = false;
                return;
            }

            if (isCorrect === true && !currentIsCorrect) {
                input.classList.add("bg-success", "bg-opacity-25", "border", "border-success", "text-white");
                input.classList.remove("bg-danger", "bg-opacity-25", "border-danger");
                input.disabled = true;
                input.readOnly = true;
            } else if (isCorrect === false && !currentIsWrong) {
                input.classList.add("bg-danger", "bg-opacity-25", "border", "border-danger", "text-white");
                input.classList.remove("bg-success", "bg-opacity-25", "border-success");
                input.disabled = false;
                input.readOnly = false;
            } else if (isCorrect === null) {
                input.classList.remove("bg-success", "bg-danger", "bg-opacity-25", "border", "border-success", "border-danger", "text-white");
                input.disabled = false;
                input.readOnly = false;
            }
        });
    } catch (error) {
        console.error(`Ошибка в handleFillGapsAnswer для task ${data.task_id}:`, error);
        showNotification("Не удалось отобразить ответ.");
    }
}

export function clearTask(container) {
    container.querySelectorAll(".gap-input").forEach(input => {
        input.value = "";
        input.disabled = false;
        input.readOnly = false;
        input.classList.remove(
            "bg-success",
            "bg-danger",
            "bg-opacity-25",
            "border",
            "border-success",
            "border-danger",
            "text-white"
        );
    });

    container.querySelectorAll(".badge").forEach(badge => {
        badge.classList.remove("text-decoration-line-through", "bg-secondary");
    });
}