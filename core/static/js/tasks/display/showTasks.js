import { getCsrfToken, showNotification, TASK_MAP } from "@tasks/utils.js";
import { eventBus } from '@tasks/events/eventBus.js';

const taskListContainer = document.getElementById("task-list");

const loader = document.createElement("div");
loader.className = "loader-overlay";
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

/**
 * Рендерит карточку задания
 * @param {Object} task — данные задания
 * @param {boolean} replaceExisting — заменить существующую карточку с таким task_id
 */
export async function renderTaskCard(task, replaceExisting = false) {
    if (!task) return;

    const card = document.createElement("div");
    card.className = "task-card mb-3 p-2 rounded-3 position-relative";
    card.dataset.taskId = task.task_id;
    card.dataset.taskType = task.task_type;

    const contentContainer = document.createElement("div");
    contentContainer.className = "task-content";
    contentContainer.innerHTML = `<span class="text-secondary">Загрузка...</span>`;
    card.appendChild(contentContainer);

    const meta = TASK_MAP?.[task.task_type];
    if (!meta?.render) {
        contentContainer.innerHTML = "<span class='text-danger'>Не удалось отобразить задание.</span>";
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
            } else {
                contentContainer.innerHTML = "<span class='text-danger'>Не удалось отобразить задание.</span>";
            }
        } catch (err) {
            console.error(err);
            contentContainer.innerHTML = "<span class='text-danger'>Не удалось отобразить задание.</span>";
        }
    }

    if (replaceExisting) {
        const existing = taskListContainer.querySelector(`[data-task-id="${task.task_id}"]`);
        if (existing) {
            existing.replaceWith(card);
            eventBus.emit('taskCardRendered', { taskCard: card, task });
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

    document.querySelectorAll('#section-list .section-link').forEach(btn => {
        btn.classList.toggle('fw-bold', btn.dataset.sectionId === sectionId);
        btn.classList.toggle('text-primary', btn.dataset.sectionId === sectionId);
    });

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

        eventBus.emit('sectionAnswersRequested', { sectionId });
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
