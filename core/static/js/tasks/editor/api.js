import { postJSON, showNotification, getCsrfToken, getSectionId, fetchSingleTask } from "/static/js/tasks/utils.js";
import { closeTaskEditor } from "/static/js/tasks/editor/edit.js";
import { renderTaskCard } from "/static/js/tasks/display/showTasks.js";
import { eventBus } from "/static/js/tasks/events/eventBus.js";

/**
 * Валидаторы заданий по типу
 */
export const TaskValidators = {
    test: function(taskCard) {
        const blocks = [...taskCard.querySelectorAll(".question-container")];
        if (!blocks.length) return null;

        const tasks = [];
        for (const block of blocks) {
            const question = block.querySelector(".question-text")?.value.trim();
            if (!question) return null;

            const options = [...block.querySelectorAll(".answer-row")].map(row => {
                const option = row.querySelector(".answer-text")?.value.trim();
                const is_correct = !!row.querySelector(".correct-answer-checkbox")?.checked;
                return option ? { option, is_correct } : null;
            }).filter(Boolean);

            if (!options.length || !options.some(o => o.is_correct)) return null;

            tasks.push({ question, options });
        }
        return tasks.length ? tasks : null;
    },

    note: function(taskCard) {
        const editor = taskCard.querySelector(".note-editor");
        const content = editor?.value.trim() || "";
        return content ? [{ content }] : null;
    },

    true_false: function(taskCard) {
        const rows = [...taskCard.querySelectorAll(".statement-row")];
        if (!rows.length) return null;

        const tasks = [];
        for (const row of rows) {
            const statement = row.querySelector(".statement-text")?.value.trim();
            if (!statement) return null;
            const is_true = row.querySelector(".statement-select")?.value === "true";
            tasks.push({ statement, is_true });
        }
        return tasks.length ? tasks : null;
    },

    fill_gaps: function(taskCard) {
        const editor = taskCard.querySelector(".fill-text-editor");
        const listType = taskCard.querySelector(".fill-gaps-type-select")?.value || "hidden";
        const text = editor?.innerHTML.trim() || "";

        if (!text) return null;

        const answers = [];
        const regex = /\[([^\]]+)\]/g;
        let match;
        while ((match = regex.exec(text)) !== null) answers.push(match[1]);

        return answers.length ? [{ text, answers, list_type: listType }] : null;
    },

    match_cards: function(taskCard) {
        const rows = [...taskCard.querySelectorAll(".match-card-row")];
        if (rows.length < 2) return null;

        const cards = [];
        const leftCards = new Set();
        const rightCards = new Set();

        for (const row of rows) {
            const card_left = row.querySelector(".card-left")?.value.trim();
            const card_right = row.querySelector(".card-right")?.value.trim();

            if (!card_left || !card_right) return null;
            if (leftCards.has(card_left) || rightCards.has(card_right)) return null;

            leftCards.add(card_left);
            rightCards.add(card_right);
            cards.push({ card_left, card_right });
        }

        return cards.length ? [{ cards }] : null;
    },

    text_input: function(taskCard) {
        const prompt = taskCard.querySelector(".task-prompt")?.value.trim() || "";
        const default_text = taskCard.querySelector(".task-default-text")?.value || "";
        return prompt ? [{ prompt, default_text }] : null;
    },

    integration: function(taskCard) {
        const embedCodeEl = taskCard.querySelector("textarea");
        const embedCode = embedCodeEl?.value.trim() || "";
        return embedCode ? [{ embed_code: embedCode }] : null;
    },

    file: function(taskCard) {
        const input = taskCard.querySelector(".file-input");
        return input.files.length ? [{ file: input.files[0] }] : null;
    },

    word_list: function(taskCard) {
        const rows = [...taskCard.querySelectorAll(".word-translation-row")];
        if (rows.length < 2) return null;

        const words = [];
        const wordSet = new Set();
        const translationSet = new Set();

        for (const row of rows) {
            const word = row.querySelector(".word-input")?.value.trim();
            const translation = row.querySelector(".translation-input")?.value.trim();

            if (!word || !translation) return null;
            if (wordSet.has(word) || translationSet.has(translation)) return null;

            wordSet.add(word);
            translationSet.add(translation);
            words.push({ word, translation });
        }

        return words.length ? [{ words }] : null;
    },
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

    const saveBtn = taskCard.querySelector('.save-btn');
    let originalText = '';

    if (saveBtn) {
        originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.classList.add('disabled');
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Сохранение...';
    }

    try {
        let result;

        if (["file"].includes(taskType)) {
            const fileObj = data[0];
            console.log(data, fileObj);
            const body = new FormData();
            body.append("task_type", taskType);
            body.append("section_id", sectionId);
            if (taskId) body.append("task_id", taskId);
            if (fileObj.file) body.append("file", fileObj.file);
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
            showNotification(`Ошибка сохранения: ${result?.errors || result}`);
            console.error(result?.errors || result);

            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.classList.remove('disabled');
                saveBtn.innerHTML = originalText;
            }

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
                    await renderTaskCard(taskObj.task, replaceExisting);
                } catch (err) {
                    console.warn("renderTaskCard failed:", err);
                }
            }
        }

        closeTaskEditor();

        eventBus.emit("section:change", { sectionId });

        return savedTaskId;
    } catch (err) {
        console.error(err);
        showNotification("Ошибка сети");

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('disabled');
            saveBtn.innerHTML = originalText;
        }

        return null;
    } finally {
        if (saveBtn && saveBtn.disabled) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('disabled');
            saveBtn.innerHTML = originalText;
        }
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
        const sectionId = getSectionId();
        if (sectionId) {
            eventBus.emit("section:change", { sectionId });
        }
        return json;
    } catch (err) {
        console.error("deleteTask error:", err);
        showNotification("Ошибка сети");
        return null;
    }
}

/**
 * Отправляет новый порядок заданий на сервер.
 *
 * @param {string[]} taskIds - массив id задач в новом порядке
 */
export async function sendNewOrderToServer(taskIds) {
    const sectionId = getSectionId();

    if (!taskIds.length) {
        showNotification('Нет заданий для сохранения порядка');
        return;
    }

    try {
        const res = await fetch('/courses/tasks/reorder/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                section_id: sectionId,
                task_ids: taskIds
            })
        });

        if (!res.ok) {
            console.error('Не удалось сохранить порядок заданий', res.status);
            showNotification('Не удалось сохранить порядок заданий');
            return;
        }

        eventBus.emit("section:change", { sectionId });
    } catch (err) {
        console.error('Ошибка при сохранении порядка заданий:', err);
        showNotification('Ошибка при сохранении порядка заданий');
    }
}

