import { getCsrfToken, showNotification, TASK_MAP, getSectionId } from "/static/js/tasks/utils.js";
import { eventBus } from '/static/js/tasks/events/eventBus.js';
import { processTaskAnswer } from "/static/classroom/answers/utils.js";

const taskListContainer = document.getElementById("task-list");

const loader = document.createElement("div");
loader.className = "loader-overlay d-flex justify-content-center w-100";
loader.innerHTML = `
    <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Загрузка...</span>
    </div>
`;

taskListContainer.appendChild(loader);

/**
 * Кеш загруженных рендереров по task_type
 */
const TASK_RENDERERS = Object.create(null);

/**
 * Загружает рендер-функцию для task_type, если ещё не загружена
 * @param {string} taskType
 */
async function loadRenderer(taskType) {
    if (!taskType || TASK_RENDERERS[taskType]) return;

    const meta = TASK_MAP?.[taskType];
    if (!meta) {
        console.warn(`Нет маппинга для task_type "${taskType}"`);
        TASK_RENDERERS[taskType] = null;
        return;
    }

    const mapping = meta.render;
    if (!mapping) {
        TASK_RENDERERS[taskType] = null;
        return;
    }

    const [modulePath, exportName] = mapping;

    try {
        const mod = await import(modulePath);
        if (exportName in mod && typeof mod[exportName] === "function") {
            TASK_RENDERERS[taskType] = mod[exportName];
        } else if (mod.default && typeof mod.default === "function") {
            TASK_RENDERERS[taskType] = mod.default;
        } else {
            TASK_RENDERERS[taskType] = null;
            console.warn(`Экспорт "${exportName}" не найден в ${modulePath}`);
        }
    } catch (err) {
        console.error(`Ошибка импорта ${modulePath}:`, err);
        TASK_RENDERERS[taskType] = null;
    }
}

export async function renderTaskCard(task, replaceExisting = false) {
    if (!task) return;

    const loader = document.createElement("div");
    loader.className = "loader-overlay d-flex justify-content-center align-items-center position-absolute w-100 h-100";
    loader.style.top = "0";
    loader.style.left = "0";
    loader.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
    loader.style.zIndex = "100";
    loader.innerHTML = `
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Загрузка...</span>
        </div>
    `;

    const card = document.createElement("div");
    card.className = "task-card mb-3 p-2 rounded-3 position-relative";
    card.dataset.taskId = task.task_id;
    card.dataset.taskType = task.task_type;
    card.appendChild(loader);

    const contentContainer = document.createElement("div");
    contentContainer.className = "task-content";
    contentContainer.style.opacity = "0.5";
    card.appendChild(contentContainer);

    const meta = TASK_MAP?.[task.task_type];
    if (!meta?.render) {
        contentContainer.innerHTML = "<span class='text-danger'>Не удалось отобразить задание.</span>";
        loader.remove();
        contentContainer.style.opacity = "1";
    } else {
        const [modulePath, fnName] = meta.render;
        try {
            const mod = await import(modulePath);
            const renderer = fnName && typeof mod[fnName] === "function"
                ? mod[fnName]
                : typeof mod.default === "function"
                    ? mod.default
                    : null;

            if (renderer) {
                contentContainer.innerHTML = "";
                renderer(task, contentContainer);
                loader.remove();
                contentContainer.style.opacity = "1";
            } else {
                contentContainer.innerHTML = "<span class='text-danger'>Не удалось отобразить задание.</span>";
                loader.remove();
                contentContainer.style.opacity = "1";
            }
        } catch (err) {
            console.error(err);
            contentContainer.innerHTML = "<span class='text-danger'>Не удалось отобразить задание.</span>";
            loader.remove();
            contentContainer.style.opacity = "1";
        }
    }

    if (replaceExisting) {
        const existing = taskListContainer.querySelector(`[data-task-id="${task.task_id}"]`);
        if (existing) {
            existing.replaceWith(card);
            eventBus.emit('taskCardRendered', { taskCard: card, task });
            await processTaskAnswer(task.task_id);
        }
        return;
    }

    taskListContainer.appendChild(card);
    eventBus.emit('taskCardRendered', { taskCard: card, task });
}

let activeSectionRequestId = 0;

/**
 * Загружает задания выбранного раздела
 * @param {string} sectionId
 */
export async function loadSectionTasks(sectionId) {
    if (!taskListContainer || !sectionId) return;

    const requestId = ++activeSectionRequestId;

    taskListContainer.innerHTML = "";
    loader.style.display = "flex";

    try {
        const tasks = await fetchSectionTasks(sectionId);
        if (requestId !== activeSectionRequestId) return;

        if (!Array.isArray(tasks) || tasks.length === 0) return;

        const uniqueTypes = [...new Set(tasks.map(t => t.task_type))];
        await Promise.all(uniqueTypes.map(loadRenderer));
        if (requestId !== activeSectionRequestId) return;

        for (const task of tasks) {
            if (requestId !== activeSectionRequestId) return;
            await renderTaskCard(task);
        }

        eventBus.emit('sectionRendered', { sectionId });
    } catch (err) {
        if (requestId === activeSectionRequestId) {
            console.error(err);
            showNotification("Ошибка при загрузке заданий");
        }
    } finally {
        if (requestId === activeSectionRequestId) {
            loader.style.display = "none";
        }
    }
}

/**
 * Получает задания с сервера
 * @param {string} sectionId
 * @returns {Promise<Array>}
 */
async function fetchSectionTasks(sectionId) {
    if (!sectionId) {
        showNotification("Произошла ошибка. Невозможно загрузить задания.");
        throw new Error("sectionId не определен");
    }

    try {
        const res = await fetch(`/courses/get-tasks/${sectionId}/`);
        const data = await res.json();

        if (!data.success) {
            showNotification(`Ошибка: ${data.errors}`);
            return [];
        }

        return data.tasks;
    } catch (err) {
        console.error(err);
        showNotification("Ошибка сети при загрузке заданий");
        return [];
    }
}
