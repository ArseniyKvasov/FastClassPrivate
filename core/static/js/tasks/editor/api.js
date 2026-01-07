import { postJSON, showNotification, getCsrfToken, getSectionId, fetchSingleTask } from "/static/js/tasks/utils.js";
import { renderTaskCard } from "/static/js/tasks/display/showTasks.js";
import { eventBus } from "/static/js/tasks/events/eventBus.js";

/**
 * Закрывает редактор задания. Скрывает модальное окно или удаляет карточку редактора из DOM.
 */
export function closeTaskEditor() {
    const modalEl = document.querySelector(".modal.show .task-editor-card");
    if (modalEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalEl.closest(".modal"));
        if (modalInstance) modalInstance.hide();
        return;
    }

    const editor = document.querySelector(".task-editor-card");
    if (editor) editor.remove();

    const form = document.querySelector("#taskEditorForm");
    if (form && form.reset) form.reset();

    document.querySelectorAll(".task-card.editing").forEach(el => el.classList.remove("editing"));
}

/**
 * Валидаторы заданий по типу
 */
export const TaskValidators = {
    test: function(taskCard) {
        const blocks = [...taskCard.querySelectorAll(".question-container")];
        if (!blocks.length) { showNotification("Добавьте хотя бы один вопрос!"); return null; }

        const tasks = [];
        for (const block of blocks) {
            const question = block.querySelector(".question-text")?.value.trim();
            if (!question) { showNotification("Укажите текст вопроса!"); return null; }

            const options = [...block.querySelectorAll(".answer-row")].map(row => {
                const option = row.querySelector(".answer-text")?.value.trim();
                const is_correct = !!row.querySelector(".correct-answer-checkbox")?.checked;
                return option ? { option, is_correct } : null;
            }).filter(Boolean);

            if (!options.length) { showNotification("Укажите хотя бы один вариант ответа!"); return null; }
            if (!options.some(o => o.is_correct)) { showNotification("Хотя бы один вариант должен быть отмечен как правильный!"); return null; }

            tasks.push({ question, options });
        }
        return tasks;
    },

    note: function(taskCard) {
        const editor = taskCard.querySelector(".note-editor");
        const content = editor?.innerHTML.trim() || "";
        if (!content) { showNotification("Добавьте текст заметки!"); return null; }
        return [{ content }];
    },

    image: function(taskCard) {
        const input = taskCard.querySelector(".image-input");
        const preview = taskCard.querySelector(".preview-img");

        if (!input?.files?.length && !preview?.src) {
            showNotification("Добавьте изображение!");
            return null;
        }

        const file = input.files[0] || null;
        const caption = taskCard.querySelector(".caption-input")?.value.trim() || "";

        const allowed = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
        if (file && !allowed.includes(file.type)) {
            showNotification("Неподдерживаемый формат изображения");
            return null;
        }

        const maxSizeMB = 5;
        if (file && file.size > maxSizeMB * 1024 * 1024) {
            showNotification(`Изображение не должно превышать ${maxSizeMB} МБ`);
            return null;
        }

        return [{ file, caption }];
    },

    true_false: function(taskCard) {
        const rows = [...taskCard.querySelectorAll(".statement-row")];
        if (!rows.length) { showNotification("Добавьте хотя бы одно утверждение!"); return null; }

        const tasks = [];
        for (const row of rows) {
            const statement = row.querySelector(".statement-text")?.value.trim();
            if (!statement) { showNotification("Укажите текст утверждения!"); return null; }
            const is_true = row.querySelector(".statement-select")?.value === "true";
            tasks.push({ statement, is_true });
        }
        return tasks;
    },

    fill_gaps: function(taskCard) {
        const editor = taskCard.querySelector(".fill-text-editor");
        const taskType = taskCard.querySelector(".fill-gaps-type-select")?.value || "hidden";
        const text = editor?.innerHTML.trim() || "";

        if (!text) {
            showNotification("Введите текст задания!");
            return null;
        }

        const answers = [];
        const regex = /\[([^\]]+)\]/g;
        let match;
        while ((match = regex.exec(text)) !== null) answers.push(match[1]);

        if (!answers.length) {
            showNotification("Добавьте хотя бы один пропуск в квадратных скобках");
            return null;
        }

        return [{ text, answers, task_type: taskType }];
    },

    match_cards: function(taskCard) {
        const rows = [...taskCard.querySelectorAll(".match-card-row")];
        if (rows.length < 2) { showNotification("Добавьте как минимум две пары карточек!"); return null; }

        const cards = [];
        const leftCards = new Set();
        const rightCards = new Set();

        for (const row of rows) {
            const card_left = row.querySelector(".card-left")?.value.trim();
            const card_right = row.querySelector(".card-right")?.value.trim();

            if (!card_left || !card_right) {
                showNotification("Каждая карточка должна содержать левую и правую части!");
                return null;
            }

            if (leftCards.has(card_left)) {
                showNotification("Найдены одинаковые левые карточки!");
                return null;
            }

            if (rightCards.has(card_right)) {
                showNotification("Найдены одинаковые правые карточки!");
                return null;
            }

            leftCards.add(card_left);
            rightCards.add(card_right);
            cards.push({ card_left, card_right });
        }

        return [{ cards }];
    },

    text_input: function(taskCard) {
        const promptEl = taskCard.querySelector(".task-prompt");
        const defaultEl = taskCard.querySelector(".task-default-text");
        const prompt = promptEl?.value.trim() || "";
        const default_text = defaultEl?.value || "";
        if (!prompt) { showNotification("Введите текст задания!"); return null; }
        return [{ prompt, default_text }];
    },

    integration: function(taskCard) {
        const embedCodeEl = taskCard.querySelector("textarea");
        const embedCode = embedCodeEl?.value.trim() || "";

        if (!embedCode) {
            showNotification("Введите embed-код!");
            return null;
        }

        if (!embedCode.includes('<iframe')) {
            showNotification("Код должен содержать iframe!");
            return null;
        }

        const supportedDomains = [
            'youtube.com', 'youtu.be', 'wordwall.net', 'miro.com',
            'quizlet.com', 'learningapps.org', 'rutube.ru', 'sboard.online'
        ];

        const hasSupportedDomain = supportedDomains.some(domain => embedCode.includes(domain));
        if (!hasSupportedDomain) {
            showNotification("Код содержит неподдерживаемый ресурс!");
            return null;
        }

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = embedCode;
        const iframe = tempDiv.querySelector('iframe');

        if (!iframe) {
            showNotification("Не удалось найти iframe в коде!");
            return null;
        }

        const cleanIframe = document.createElement('iframe');
        const allowedAttributes = ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'title'];

        allowedAttributes.forEach(attr => {
            if (iframe.hasAttribute(attr)) {
                cleanIframe.setAttribute(attr, iframe.getAttribute(attr));
            }
        });

        cleanIframe.style.border = 'none';
        cleanIframe.style.maxWidth = '100%';

        return [{ embed_code: cleanIframe.outerHTML }];
    }
};

/**
 * Сохраняет задание на сервере. Поддерживает JSON и FormData (image).
 * После успешного сохранения попытается получить свежие данные задания и отобразить карточку.
 * @param {string} taskType
 * @param {HTMLElement} taskCard
 * @param {string|null} taskId
 * @returns {Promise<string|null>}
 */
export async function saveTask(taskType, taskCard, taskId = null) {
    const sectionId = getSectionId();
    if (!sectionId) {
        showNotification("Произошла ошибка. Вы не можете создавать задания.");
        return null;
    }

    const validator = TaskValidators[taskType];
    if (!validator) {
        console.warn("Validator not found for", taskType);
        showNotification("Неподдерживаемый тип задания");
        return null;
    }

    const data = validator(taskCard);
    if (!data) return null;

    try {
        let result;

        if (taskType === "image") {
            const fileObj = data[0];
            const body = new FormData();
            body.append("task_type", taskType);
            body.append("section_id", sectionId);
            if (taskId) body.append("task_id", taskId);
            if (fileObj.file) body.append("image", fileObj.file);
            body.append("caption", fileObj.caption || "");

            const res = await fetch("/courses/save-task/", {
                method: "POST",
                headers: { "X-CSRFToken": getCsrfToken() },
                body
            });
            result = await res.json();
        } else {
            result = await postJSON("/courses/save-task/", {
                task_type: taskType,
                task_id: taskId,
                section_id: sectionId,
                data
            });
        }

        if (!result?.success) {
            showNotification("Ошибка сохранения: см. консоль");
            console.error(result?.errors || result);
            return null;
        }

        const savedTaskId = result.task_id || (result.tasks?.[0]?.task_id) || null;

        if (savedTaskId) {
            let taskObj = null;
            if (typeof fetchSingleTask === "function") {
                try {
                    taskObj = await fetchSingleTask(savedTaskId);
                } catch (err) {
                    console.warn("fetchSingleTask failed:", err);
                }
            }

            if (!taskObj && result.task) {
                taskObj = result.task;
            }

            if (taskObj && typeof renderTaskCard === "function") {
                try {
                    const replaceExisting = !!taskId;
                    renderTaskCard(taskObj.task, replaceExisting);
                } catch (err) {
                    console.warn("renderTaskCard failed:", err);
                }
            }
        }

        showNotification("Задание сохранено!");
        closeTaskEditor();

        eventBus.emit("section:change", { sectionId });

        return savedTaskId;
    } catch (err) {
        console.error(err);
        showNotification("Ошибка сети");
        return null;
    }
}

/**
 * Удаление задания
 * @param {string|number} taskId
 * @returns {Promise<Object|null>}
 */
export async function deleteTask(taskId) {
    if (!taskId) return null;

    try {
        const json = await postJSON("/courses/delete-task/", { task_id: taskId });
        if (!json?.success) {
            showNotification("Ошибка удаления задания");
            console.error(json);
            return json;
        }
        showNotification("Задание удалено");
        eventBus.emit("section:change", { sectionId });
        return json;
    } catch (err) {
        console.error("deleteTask error:", err);
        showNotification("Ошибка сети");
        return null;
    }
}
