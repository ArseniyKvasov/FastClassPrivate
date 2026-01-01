/**
 * Управление созданием и редактированием заданий.
 *
 * Изменения:
 *  - Редакторы возвращают HTMLElement; отображение/обновление карточек регулирует saveTask.
 *  - Редактор при редактировании всегда в модалке.
 */

import { showNotification, fetchSingleTask, TASK_MAP, confirmAction } from "../utils.js";
import { saveTask, deleteTask } from "./api.js";
import { eventBus } from '../events/eventBus.js';

const loadingTypes = new Set();
const editorModuleCache = new Map();

/**
 * @param {string} modulePath
 * @returns {Promise<Module|null>}
 */
async function importEditorModule(modulePath) {
    if (!modulePath) {
        console.error("importEditorModule: empty modulePath");
        return null;
    }
    if (editorModuleCache.has(modulePath)) return editorModuleCache.get(modulePath);
    try {
        const mod = await import(modulePath);
        editorModuleCache.set(modulePath, mod);
        return mod;
    } catch (err) {
        console.error("dynamic import error:", modulePath, err);
        editorModuleCache.delete(modulePath);
        return null;
    }
}

/**
 * dogstring:
 * Получить функцию-редактор по типу из TASK_MAP.
 *
 * @param {string} type
 * @returns {Promise<Function|null>}
 */
async function getEditorHandler(type) {
    if (!type) return null;
    const meta = TASK_MAP?.[type];
    if (!meta) {
        console.error(`getEditorHandler: unknown type "${type}"`);
        return null;
    }
    const spec = meta.edit;
    if (!Array.isArray(spec) || spec.length < 1) {
        console.error(`getEditorHandler: bad .edit spec for "${type}"`);
        return null;
    }
    const [modulePath, fnName] = spec;
    if (!modulePath) return null;
    const mod = await importEditorModule(modulePath);
    if (!mod) {
        showNotification(`Не удалось загрузить модуль редактора для "${type}"`);
        return null;
    }
    if (fnName && typeof mod[fnName] === "function") return mod[fnName];
    if (typeof mod.default === "function") return mod.default;
    console.error("getEditorHandler: no suitable export", modulePath, Object.keys(mod));
    showNotification(`Редактор для типа "${type}" недоступен`);
    return null;
}

/**
 * dogstring:
 * Возвращает/создаёт модалку редактора; очищает тело и состояние при закрытии.
 *
 * @returns {{ el: HTMLElement, bsInstance: bootstrap.Modal, body: HTMLElement }}
 */
function ensureEditorModal() {
    let el = document.getElementById("editorModal");
    if (el) {
        const bs = new bootstrap.Modal(el);
        const body = el.querySelector(".editor-modal-body") || el.querySelector(".modal-body");
        return { el, bsInstance: bs, body };
    }

    el = document.createElement("div");
    el.id = "editorModal";
    el.className = "modal fade";
    el.tabIndex = -1;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-body editor-modal-body"></div>
            </div>
        </div>
    `;
    document.body.appendChild(el);
    const bsInstance = new bootstrap.Modal(el);
    const body = el.querySelector(".editor-modal-body");

    el.addEventListener("hidden.bs.modal", () => {
        body.querySelectorAll(".task-editor-card, .task-editor").forEach(n => n.remove());
        body.innerHTML = "";
        document.querySelectorAll(".task-card.editing").forEach(tc => tc.classList.remove("editing"));
    });

    return { el, bsInstance, body };
}

/**
 * @param {HTMLElement|null} container
 * @returns {HTMLElement}
 */
function prepareEditorContainer(container = null) {
    const parent = container || document.body;
    parent.querySelectorAll(".task-editor-card, .task-editor").forEach(n => n.remove());
    return parent;
}

/**
 * @param {HTMLElement} card
 * @param {string} type
 * @param {string|null} taskId
 */
function attachSaveHandlerToEditorCard(card, type, taskId = null) {
    if (!card || !type) return;
    if (card.dataset.saveBound === "1") return;
    const saveBtn = card.querySelector(".save-btn");
    if (!saveBtn) {
        card.dataset.saveBound = "1";
        return;
    }

    saveBtn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        try {
            const res = await saveTask(type, card, taskId);
            if (res) {
                if (typeof res === "object") {
                    if (res.id) card.dataset.taskId = String(res.id);
                    if (res.task_type) card.dataset.taskType = res.task_type;
                }
            } else {
                showNotification("Сохранение не удалось");
            }
        } catch (err) {
            console.error("saveTask error:", err);
            showNotification("Ошибка при сохранении задания");
        }
    }, { once: false });

    card.dataset.saveBound = "1";
}

function createTypeOptionNode(type, meta) {
    const icon = meta.icon ?? "bi-file-earmark";
    const label = meta.label ?? type;
    const col = document.createElement("div");
    col.className = "col-6 col-md-4 col-lg-3 d-flex";
    col.innerHTML = `
        <div class="task-type-option flex-fill text-center rounded-4 p-3 bg-white"
             data-type="${type}"
             style="cursor:pointer; transition: transform .12s, background-color .12s;">
            <i class="bi ${icon} fs-3 text-primary mb-2" aria-hidden="true"></i>
            <div class="small fw-medium">${label}</div>
        </div>
    `;
    return col;
}

/**
 * @returns {Promise<void>}
 */
export async function createTaskTypeSelector() {
    const selectorEl = document.getElementById("taskSelectorModal");
    const container = document.getElementById("taskTypeSelectorContainer");
    if (!selectorEl || !container) {
        console.error("createTaskTypeSelector: missing elements");
        return;
    }

    const selectorModal = new bootstrap.Modal(selectorEl);
    container.innerHTML = "";

    Object.entries(TASK_MAP).forEach(([type, meta]) => {
        if (!meta?.edit) return;
        container.appendChild(createTypeOptionNode(type, meta));
    });

    container.onclick = async (e) => {
        const option = e.target.closest(".task-type-option");
        if (!option) return;
        const type = option.dataset.type;
        if (!type) return;
        if (loadingTypes.has(type)) {
            showNotification("Редактор уже загружается...");
            return;
        }
        loadingTypes.add(type);
        try {
            const editor = await getEditorHandler(type);
            if (!editor) return;
            try { selectorModal.hide(); } catch {}
            const insertParent = document.getElementById("task-list") || document.body;
            prepareEditorContainer(insertParent);
            try {
                const result = await editor(null);
                let returnedCard = null;
                if (result instanceof HTMLElement) returnedCard = result;
                else if (result && result.element instanceof HTMLElement) returnedCard = result.element;
                else {
                    const fallback = insertParent.querySelector(".task-editor-card, .task-editor");
                    if (fallback) returnedCard = fallback;
                }

                if (!returnedCard) {
                    showNotification("Редактор не вернул карточку");
                    return;
                }

                if (!returnedCard.dataset.taskType) returnedCard.dataset.taskType = type;
                insertParent.appendChild(returnedCard);
                attachSaveHandlerToEditorCard(returnedCard, type);
                returnedCard.scrollIntoView({ behavior: "smooth", block: "center" });
            } catch (err) {
                console.error("editor() create error:", err);
                showNotification("Ошибка при открытии редактора");
            }
        } finally {
            loadingTypes.delete(type);
        }
    };

    selectorModal.show();
}

/**
 * dogstring:
 * Открыть редактор в модальном окне для существующего задания.
 *
 * @param {string|number} taskId
 * @returns {Promise<void>}
 */
export async function openEditorForTask(taskId) {
    if (!taskId) {
        showNotification("Не указан идентификатор задания");
        return;
    }

    const taskCard = document.querySelector(`.task-card[data-task-id="${String(taskId)}"]`);
    if (!taskCard) {
        showNotification("Карточка задания не найдена на странице");
        return;
    }

    const taskType = taskCard.dataset.taskType;
    if (!taskType) {
        showNotification("Тип задания не указан в карточке");
        return;
    }

    if (loadingTypes.has(taskType)) {
        showNotification("Редактор уже загружается...");
        return;
    }
    loadingTypes.add(taskType);

    try {
        const editor = await getEditorHandler(taskType);
        if (!editor) return;

        let taskInfo = null;
        try {
            taskInfo = await fetchSingleTask(taskId);
        } catch (err) {
            console.error("fetchSingleTask failed:", err);
            showNotification("Не удалось загрузить данные задания");
        }

        const { bsInstance, body } = ensureEditorModal();
        prepareEditorContainer(body);

        try {
            const taskData = taskInfo?.task?.data ?? taskInfo ?? null;
            const editorCard = await editor(taskData);
            let returnedCard = null;

            if (editorCard instanceof HTMLElement) returnedCard = editorCard;
            else if (editorCard && editorCard.element instanceof HTMLElement) returnedCard = editorCard.element;

            if (!returnedCard) {
                showNotification("Редактор не вернул карточку");
                return;
            }

            body.appendChild(returnedCard);

            returnedCard.querySelectorAll(".remove-task-btn, .btn-close").forEach(btn => {
                const cloned = btn.cloneNode(true);
                btn.replaceWith(cloned);
            });
            returnedCard.querySelectorAll(".remove-task-btn, .btn-close").forEach(btn => {
                btn.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    try { bsInstance.hide(); } catch { body.innerHTML = ""; }
                });
            });

            attachSaveHandlerToEditorCard(returnedCard, taskType, String(taskId));
            bsInstance.show();
        } catch (err) {
            console.error("editor() edit error:", err);
            showNotification("Ошибка при открытии редактора");
        }
    } finally {
        loadingTypes.delete(taskType);
    }
}

export function attachControlsToTaskCard(taskCard) {
    if (!taskCard || taskCard.querySelector(".task-card-controls")) return;

    const controls = document.createElement("div");
    controls.className = "task-card-controls position-absolute top-0 end-0 m-2 d-flex gap-1";
    controls.style.opacity = "0.6";
    controls.style.zIndex = "10";

    controls.innerHTML = `
        <button class="btn btn-sm btn-light border-0 edit-task-btn" title="Редактировать">
            <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-sm btn-light border-0 delete-task-btn" title="Удалить">
            <i class="bi bi-trash"></i>
        </button>
    `;

    if (!taskCard.style.position) taskCard.style.position = "relative";
    taskCard.appendChild(controls);

    controls.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const id = taskCard.dataset.taskId;
        if (!id) return;

        if (ev.target.closest(".edit-task-btn")) {
            taskCard.classList.add("editing");
            await openEditorForTask(id);
        } else if (ev.target.closest(".delete-task-btn")) {
            const confirmed = await confirmAction("Удалить задание?");
            if (!confirmed) return;

            try {
                await deleteTask(id);
                taskCard.remove();
            } catch {
                showNotification("Ошибка удаления");
            }
        }
    });
}

eventBus.on('taskCardRendered', ({ taskCard, task }) => {
    attachControlsToTaskCard(taskCard);
});

/**
 * @returns {void}
 */
export function initEditTasks() {
    document.getElementById("add-task-btn")?.addEventListener("click", createTaskTypeSelector);
}
