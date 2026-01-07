import { eventBus } from "/static/js/tasks/events/eventBus.js";
import { showNotification, confirmAction, getSectionId } from "/static/js/tasks/utils.js";
import { ANSWER_HANDLER_MAP, getClassroomId, getViewedUserId } from "/static/classroom/answers/utils.js";
import { loadAnswerModule, fetchSectionAnswers } from "/static/classroom/answers/api.js";
import { clearTask } from "/static/classroom/answers/handlers/clearAnswers.js"
import { loadSectionStatistics } from "/static/classroom/answers/handlers/statistics.js";
import { renderGoToTaskButton, renderResetButton } from "/static/classroom/answers/teacherPanel.js"

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
 * Обрабатывает один ответ и отображает его в контейнере
 * @param {Object} answerData - Данные ответа
 */
export async function handleAnswer(answerData) {
    const { answer, task_id, task_type } = answerData;

    const container = document.querySelector(`[data-task-id="${task_id}"]`);
    if (!container) {
        return;
    }

    const module = await loadAnswerModule(task_type);
    if (!module?.handleAnswer) {
        console.warn(`Не найден handleAnswer для ${task_type}`);
        return;
    }

    try {
        module.handleAnswer(answerData, container);
    } catch (err) {
        console.warn(`Ошибка в handleAnswer (${task_type}, ${task_id})`, err);
        showNotification("Не удалось отобразить ответ.");
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

    if (userId === "all") {
        loadSectionStatistics();
        return;
    }

    try {
        const data = await fetchSectionAnswers(sectionId);

        if (!data || !Array.isArray(data.answers)) return;

        for (const answerData of data.answers) {
            await handleAnswer(answerData);
        }
    } catch (err) {
        console.warn("Ошибка в handleSectionAnswers:", err);
        showNotification("Не удалось загрузить ответы раздела.");
    }
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
        if (module?.clearTask) {
            renderResetButton(panel);
        }

        renderGoToTaskButton(panel);
    });

    eventBus.on("sectionAnswersRequested", async ({ sectionId }) => {
        await handleSectionAnswers();
    });
}
