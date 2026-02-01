/**
 * Управление созданием и редактированием заданий.
 *
 *  - Редакторы возвращают HTMLElement; отображение/обновление карточек регулирует saveTask.
 *  - Редактор при редактировании всегда в модалке.
 */

import { showNotification, fetchSingleTask, TASK_MAP, confirmAction, getSectionId } from "/static/js/tasks/utils.js";
import { saveTask, deleteTask } from "/static/js/tasks/editor/api.js";
import { eventBus } from "/static/js/tasks/events/eventBus.js";
import { clearTask } from "/static/classroom/answers/handlers/clearAnswers.js"

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
 * Получить функцию-редактор по task_type из TASK_MAP.
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
    col.className = "col-6 col-sm-4 col-lg-3 col-xxl-2 d-flex";
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
 * Открыть редактор в модальном окне для существующего задания.
 *
 * @param {string|number} taskId
 * @returns {Promise<void>}
 */
export async function openEditorForTask(taskId) {
    if (!taskId) {
        showNotification("Не указан id задания");
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

            returnedCard.querySelectorAll(".remove-task-btn").forEach(btn => {
                const cloned = btn.cloneNode(true);
                btn.replaceWith(cloned);
            });
            returnedCard.querySelectorAll(".remove-task-btn").forEach(btn => {
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

/**
 * Добавляет основные контролы к карточке задания.
 * На десктопе показываются кнопки, на мобильных — dropdown.
 * go и reset по умолчанию скрыты.
 * @param {HTMLElement} taskCard
 */
export function attachControlsToTaskCard(taskCard) {
    if (!taskCard || taskCard.querySelector(".task-card-controls")) return;

    const controls = document.createElement("div");
    controls.className = "task-card-controls position-absolute top-0 end-0 m-2 d-flex gap-1";
    controls.style.opacity = "0";
    controls.style.transition = "opacity 0.2s";

    taskCard.addEventListener("mouseenter", () => controls.style.opacity = "1");
    taskCard.addEventListener("mouseleave", () => controls.style.opacity = "0");

    controls.innerHTML = `
        <!-- Десктоп -->
        <div class="d-none d-lg-flex gap-1">
            <button class="btn btn-sm btn-light border-0 edit-task-btn" title="Редактировать">
                <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-light border-0 go-to-task-btn d-none" title="Показать ученикам">
                <i class="bi bi-broadcast"></i>
            </button>
            <button class="btn btn-sm btn-light border-0 reset-answer-btn d-none" title="Сбросить ответы">
                <i class="bi bi-arrow-counterclockwise"></i>
            </button>
            <button class="btn btn-sm btn-light border-0 delete-task-btn" title="Удалить">
                <i class="bi bi-trash"></i>
            </button>
        </div>

        <!-- Мобильный dropdown -->
        <div class="d-flex d-lg-none dropdown">
            <button class="btn btn-sm btn-light border-0 dropdown-toggle" type="button" data-bs-toggle="dropdown">
                <i class="bi bi-three-dots"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-start p-0">
                <li><button class="dropdown-item text-black edit-task-btn">Редактировать</button></li>
                <li><button class="dropdown-item text-black go-to-task-btn d-none">Показать ученикам</button></li>
                <li><button class="dropdown-item text-black reset-answer-btn d-none">Сбросить ответы</button></li>
                <li><button class="dropdown-item text-black delete-task-btn">Удалить</button></li>
            </ul>
        </div>
    `;

    if (!taskCard.style.position) taskCard.style.position = "relative";
    taskCard.appendChild(controls);

    eventBus.emit("taskCardControlsRendered", { taskCard, panel: controls });

    controls.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        const taskId = taskCard.dataset.taskId;
        if (!taskId) return;

        if (ev.target.closest(".edit-task-btn")) {
            taskCard.classList.add("editing");
            await openEditorForTask(taskId);
            return;
        }

        if (ev.target.closest(".delete-task-btn")) {
            const confirmed = await confirmAction("Вы уверены, что хотите удалить задание?");
            if (!confirmed) return;

            try {
                const result = await deleteTask(taskId);
                if (result?.success) {
                    taskCard.remove();
                }
            } catch {
                showNotification("Ошибка удаления");
            }
            return;
        }

        if (ev.target.closest(".go-to-task-btn")) {
            const sectionId = getSectionId();
            if (!sectionId) return;

            const btns = controls.querySelectorAll(".go-to-task-btn");
            btns.forEach(btn => btn.disabled = true); // блокируем на 3 секунды
            setTimeout(() => btns.forEach(btn => btn.disabled = false), 3000);

            eventBus.emit("task:attention", { sectionId, taskId });
            return;
        }

        if (ev.target.closest(".reset-answer-btn")) {
            const confirmed = await confirmAction("Сбросить ответы для этого задания?");
            if (!confirmed) return;

            try {
                await clearTask(taskId);
                eventBus.emit("answer:reset", { taskId });
                showNotification("Ответы сброшены");
            } catch (err) {
                console.error("Reset answer failed:", err);
                showNotification("Ошибка сброса ответа");
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
