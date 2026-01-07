import { showNotification, getSectionId } from '@tasks/utils.js';
import { getClassroomId, ANSWER_HANDLER_MAP } from '@classroom/answers/utils.js';

/**
 * Отображает статистику по заданию
 * @param {number|string} taskId
 * @param {Array<Object>} stats
 */
export function showStatistics(taskId, stats) {
    try {
        if (!stats || !stats.some(s => (s.correct_answers || 0) + (s.wrong_answers || 0) > 0)) {
            return;
        }

        const container = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!container) return;

        const taskType = container.dataset.taskType;
        if (!ANSWER_HANDLER_MAP[taskType]?.statistics) return;

        let statsContainer = container.querySelector(".horizontal-cards");
        if (statsContainer) statsContainer.remove();

        statsContainer = document.createElement("div");
        statsContainer.className = "horizontal-cards";

        const sortedStats = [...stats].sort(
            (a, b) => b.success_percentage - a.success_percentage
        );

        sortedStats.forEach(student => {
            const card = document.createElement("div");
            card.className = "student-card";

            const nameDiv = document.createElement("div");
            nameDiv.className = "name";
            nameDiv.textContent = student.user.username;

            const statsDiv = document.createElement("div");
            statsDiv.className = "stats";
            statsDiv.innerHTML = `
                <span class="correct text-success">${student.correct_answers}</span>
                <span>|</span>
                <span class="wrong text-danger">${student.wrong_answers}</span>
                <span>|</span>
                <span class="percent text-primary">${student.success_percentage}%</span>
            `;

            card.appendChild(nameDiv);
            card.appendChild(statsDiv);
            statsContainer.appendChild(card);
        });

        container.appendChild(statsContainer);
    } catch (error) {
        console.error("Ошибка при отображении статистики:", error);
        showNotification("Не удалось отобразить статистику");
    }
}

/**
 * Очищает статистику и скрывает кнопку проверки задания
 * @param {number|string|null} taskId
 */
export function clearStatistics(taskId = null) {
    try {
        const containers = taskId
            ? [document.querySelector(`[data-task-id="${taskId}"]`)]
            : Array.from(document.querySelectorAll(".task-card"));

        containers.forEach(container => {
            if (!container) return;

            const statsContainer = container.querySelector(".horizontal-cards");
            if (statsContainer) statsContainer.remove();

            const checkBtn = container.querySelector(".check-task-btn");
            if (checkBtn) checkBtn.style.display = "none";
        });
    } catch (error) {
        console.error("Ошибка при очистке статистики:", error);
    }
}

/**
 * Загружает статистику всего раздела
 */
export async function loadSectionStatistics() {
    try {
        const classroomId = getClassroomId();
        const sectionId = getSectionId();

        if (!classroomId || !sectionId) return;

        const response = await fetch(
            `/classroom/${classroomId}/section/${sectionId}/statistics/`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!data.tasks) return;

        data.tasks.forEach(task => {
            showStatistics(task.id, task.statistics);
        });
    } catch (error) {
        console.error('Ошибка загрузки статистики раздела:', error);
        showNotification('Не удалось отобразить статистику');
    }
}

/**
 * Загружает статистику одного задания
 * @param {number|string} taskId
 */
export async function loadTaskStatistics(taskId) {
    try {
        const classroomId = getClassroomId();
        if (!classroomId) return;

        const response = await fetch(
            `/classroom/${classroomId}/task/${taskId}/statistics/`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        if (!data.statistics || !Object.values(data.statistics).some(v => v?.length > 0)) {
            return;
        }

        const container = document.querySelector(`[data-task-id="${taskId}"]`);
        if (!container) return;

        const taskType = container.dataset.taskType;
        if (!taskClearHandlers[taskType]) return;

        showStatistics(data.task.id, data.statistics);
    } catch (error) {
        console.error(
            `Ошибка загрузки статистики для задания ${taskId}:`,
            error
        );
        showNotification('Не удалось отобразить статистику');
    }
}

