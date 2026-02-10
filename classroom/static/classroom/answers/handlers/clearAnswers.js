import { showNotification, getCsrfToken } from "js/tasks/utils.js";
import { loadAnswerModule } from "classroom/answers/api.js";
import { getViewedUserId, getClassroomId } from "classroom/utils.js";
import { clearStatistics } from "classroom/answers/handlers/statistics.js"

/**
 * Очищает UI задания по taskId
 *
 * @param {string|number} taskId
 * @returns {Promise<void>}
 */
export async function clearTaskContainer(taskId) {
    const container = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!container) return;

    const taskType = container.dataset.taskType;
    if (!taskType) return;

    const module = await loadAnswerModule(taskType);
    if (module?.clearTask) {
        module.clearTask(container);
    }

    clearStatistics(taskId);
}

/**
 * Сбрасывает ответ задания на сервере и очищает UI
 *
 * @param {string|number} taskId
 * @returns {Promise<void>}
 */
export async function clearTask(taskId) {
    const classroomId = getClassroomId();
    const userId = getViewedUserId();

    if (!taskId || !classroomId || !userId) return;

    try {
        const url = userId === "all"
            ? `/classroom/${classroomId}/task/${taskId}/delete-all-answers/`
            : `/classroom/${classroomId}/task/${taskId}/user/${userId}/delete-answers/`;

        const response = await fetch(url, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "X-Requested-With": "XMLHttpRequest",
                "X-CSRFToken": getCsrfToken(),
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        await clearTaskContainer(taskId);
    } catch (err) {
        console.error(`clearTask error (taskId=${taskId}):`, err);
        showNotification("Ошибка при сбросе ответа");
    }
}

/**
 * Очищает UI всех заданий без запросов на сервер
 */
export async function clearAllTaskContainers() {
    const taskCards = document.querySelectorAll(".task-card");

    for (const card of taskCards) {
        const taskId = card.dataset.taskId;
        if (taskId) {
            await clearTaskContainer(taskId);
        }
    }
}
