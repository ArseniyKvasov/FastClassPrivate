import { showNotification, postJSON } from "/static/js/tasks/utils.js";
import { eventBus } from "/static/js/tasks/events/eventBus.js";
import { loadAnswerModule, fetchTaskAnswer } from "/static/classroom/answers/api.js";

export const ANSWER_HANDLER_MAP = {
    match_cards: {
        file: "common/matchCards.js",
        statistics: true
    },
    fill_gaps: {
        file: "common/fillGaps.js",
        statistics: true
    },
    test: {
        file: "common/test.js",
        statistics: true
    },
    true_false: {
        file: "common/trueFalse.js",
        statistics: true
    },
    text_input: {
        file: "common/textInput.js",
        statistics: false
    }
};

export function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

export function adjustTextareaHeight(textarea) {
    textarea.rows = 2;
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    const lines = Math.ceil(textarea.scrollHeight / lineHeight);
    textarea.rows = Math.min(Math.max(lines, 2), 8);
}

export function getTaskTypeFromContainer(taskId) {
    const container = document.querySelector(`[data-task-id="${taskId}"]`);
    return container?.dataset?.taskType;
}

export function updateBadgesStrikethrough(container, answers) {
    const badges = container.querySelectorAll(".badge.bg-primary");
    const usedBadges = new Set();

    badges.forEach(badge => {
        badge.classList.remove("text-decoration-line-through", "bg-secondary");
    });

    Object.values(answers).forEach(answerData => {
        if (answerData?.value && answerData?.is_correct === true) {
            const answerValue = answerData.value.trim().toLowerCase();
            const matchingBadge = Array.from(badges).find(badge =>
                badge.textContent.trim().toLowerCase() === answerValue &&
                !usedBadges.has(badge)
            );

            if (matchingBadge) {
                matchingBadge.classList.add("text-decoration-line-through", "bg-secondary");
                usedBadges.add(matchingBadge);
            }
        }
    });
}

export async function initCheckButton(task, container) {
    const classroomId = getClassroomId();
    const userId = getViewedUserId();

    if (!classroomId) {
        showNotification("Контекст класса не найден");
        return;
    }

    const checkBtn = container.querySelector("button.btn-primary");
    if (!checkBtn) {
        showNotification("Кнопка проверки не найдена");
        return;
    }

    const answerModule = await loadAnswerModule(task.task_type);
    if (!answerModule) {
        showNotification("Модуль обработки задания не найден");
        return;
    }

    const { collectAnswers, handleAnswer } = answerModule;

    if (typeof collectAnswers !== "function") {
        showNotification("Сбор ответов для этого задания не поддерживается");
        return;
    }

    function allFormsAnswered() {
        const forms = Array.from(container.querySelectorAll("form"));
        if (!forms.length) return false;

        return forms.every(form =>
            form.querySelector('input[type="radio"]:checked') !== null
        );
    }

    function updateButtonState() {
        const isChecked = container.dataset.isChecked === "true";
        checkBtn.disabled = !allFormsAnswered() || isChecked || userId === "all";
    }

    container.querySelectorAll("form").forEach(form => {
        form.addEventListener("change", updateButtonState);
    });

    updateButtonState();

    checkBtn.addEventListener("click", async () => {
        if (checkBtn.disabled) return;

        let answers;

        try {
            answers = collectAnswers(task, container);
        } catch (err) {
            console.error("collectAnswers error:", err);
            showNotification("Ошибка при сборе ответов");
            return;
        }

        if (!Array.isArray(answers) || !answers.length) {
            showNotification("Ответы не заполнены");
            return;
        }

        checkBtn.disabled = true;

        try {
            const result = await postJSON(
                `/classroom/${classroomId}/mark-answer-as-checked/`,
                {
                    task_id: task.task_id,
                    user_id: userId,
                    answers
                }
            );

            if (!result?.success) {
                console.error("Backend error response:", result);
                throw new Error("Backend error");
            }

            container.dataset.isChecked = "true";

            if (typeof handleAnswer === "function") {
                const taskId = task.task_id;
                const data = await fetchTaskAnswer(taskId);
                handleAnswer(data, container);

                eventBus.emit("answer:sent", { taskId });
            }
        } catch (err) {
            console.error("Save answer failed:", err);
            showNotification("Не удалось сохранить ответы");
            checkBtn.disabled = false;
        }
    });
}

export function getClassroomId() {
    const info = document.getElementById("info");
    return info?.dataset?.classroomId || null;
}

export function getViewedUserId() {
    const info = document.getElementById("info");
    return info?.dataset?.viewedUserId || null;
}
