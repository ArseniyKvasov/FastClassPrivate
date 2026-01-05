import { eventBus } from "@events/eventBus";
import { showNotification, confirmAction, getSectionId } from "@tasks/utils";
import { ANSWER_HANDLER_MAP, getClassroomId, getViewedUserId } from "@classroom/answers/utils.js";
import { loadAnswerModule, fetchSectionAnswers } from "@classroom/answers/api.js";
import { clearTask } from "./handlers/clearAnswers.js"

/**
 * Инициализация обработчиков ответа для одной карточки задания
 *
 * @param {HTMLElement} taskCard
 * @param {Object} task
 * @returns {Promise<void>}
 */
export async function initTaskAnswerHandlers(taskCard, task) {
    const module = await loadAnswerModule(task.task_type);
    if (!module) {
        return;
    }

    if (typeof module.bindAnswerSubmission === "function") {
        module.bindAnswerSubmission(taskCard, task);
    }
}

/**
 * Обрабатывает и отображает ответы раздела
 *
 * @returns {Promise<void>}
 */
export async function handleSectionAnswers() {
    const sectionId = getSectionId();
    const classroomId = getClassroomId();
    const userId = getViewedUserId();

    if (!classroomId || !userId) {
        showNotification("Произошла ошибка. Не указан виртуальный класс.");
        return;
    }

    try {
        const data = await fetchSectionAnswers(sectionId);

        if (!data || !Array.isArray(data.answers)) {
            return;
        }

        for (const answerData of data.answers) {
            const { task_id, task_type } = answerData;

            const container = document.querySelector(
                `[data-task-id="${task_id}"]`
            );

            if (!container) {
                console.warn(`Контейнер не найден для task_id: ${task_id}`);
                showNotification('Произошла ошибка - обновите страницу.')
                continue;
            }

            const module = await loadAnswerModule(task_type);
            if (!module?.handleAnswer) {
                console.warn(`Не найден handleAnswer для ${task_type}`);
                continue;
            }

            try {
                module.handleAnswer(answerData, container);
            } catch (err) {
                console.warn(
                    `Ошибка в handleAnswer (${task_type}, ${task_id})`,
                    err
                );
                showNotification("Не удалось отобразить ответ.");
            }
        }
    } catch (err) {
        console.warn("Ошибка в handleSectionAnswers:", err);
        showNotification("Не удалось загрузить ответы раздела.");
    }
}

export function renderResetButton(panel) {
    if (!panel || panel.querySelector(".reset-answer-btn")) return;

    const editBtn = panel.querySelector(".edit-task-btn");
    if (!editBtn) return;

    const resetBtn = document.createElement("button");
    resetBtn.className = "btn btn-sm btn-light border-0 reset-answer-btn";
    resetBtn.title = "Сбросить ответ";

    resetBtn.innerHTML = `<i class="bi bi-arrow-counterclockwise"></i>`;

    editBtn.insertAdjacentElement("afterend", resetBtn);

    resetBtn.addEventListener("click", async (ev) => {
        ev.stopPropagation();

        const taskCard = panel.closest(".task-card");
        const taskId = taskCard?.dataset?.taskId;
        if (!taskId) return;

        const confirmed = await confirmAction("Сбросить ответы для этого задания?");
        if (!confirmed) return;

        try {
            await clearTask(taskId);
        } catch (err) {
            console.error("Reset answer failed:", err);
            showNotification("Ошибка сброса ответа");
        }
    });
}

/**
 * Регистрация событий, связанных с ответами
 */
export function registerAnswerEvents() {
    eventBus.on("taskCardRendered", async ({ taskCard, task }) => {
        await initTaskAnswerHandlers(taskCard, task);
    });

    eventBus.on("taskCardControlsRendered", async ({ panel, taskCard }) => {
        const taskType = taskCard?.dataset?.taskType;
        if (!taskType) return;

        const module = await loadAnswerModule(taskType);
        if (!module?.clearTask) return;

        renderResetButton(panel);
    });

    eventBus.on("sectionAnswersRequested", async ({ sectionId }) => {
        await handleSectionAnswers();
    });
}
