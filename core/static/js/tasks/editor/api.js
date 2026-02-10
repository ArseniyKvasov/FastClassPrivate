import { postJSON, showNotification, getCsrfToken, getSectionId, fetchSingleTask } from "js/tasks/utils.js";
import { closeTaskEditor } from "js/tasks/editor/edit.js";
import { renderTaskCard } from "js/tasks/display/showTasks.js";
import { eventBus } from "js/tasks/events/eventBus.js";

/**
 * Валидаторы заданий по типу
 */
export const TaskValidators = {
    test: function(taskCard) {
        const blocks = [...taskCard.querySelectorAll(".question-container")];
        if (!blocks.length) {
            showNotification("Добавьте хотя бы один вопрос");
            return null;
        }

        const tasks = [];
        for (const [index, block] of blocks.entries()) {
            const question = block.querySelector(".question-text")?.value.trim();
            if (!question) {
                showNotification(`Вопрос #${index + 1}: введите текст вопроса`);
                return null;
            }

            const options = [...block.querySelectorAll(".answer-row")].map(row => {
                const option = row.querySelector(".answer-text")?.value.trim();
                const is_correct = !!row.querySelector(".correct-answer-checkbox")?.checked;
                return option ? { option, is_correct } : null;
            }).filter(Boolean);

            if (!options.length) {
                showNotification(`Вопрос #${index + 1}: добавьте варианты ответов`);
                return null;
            }

            if (!options.some(o => o.is_correct)) {
                showNotification(`Вопрос #${index + 1}: отметьте хотя бы один правильный ответ`);
                return null;
            }

            tasks.push({ question, options });
        }
        return tasks.length ? tasks : null;
    },

    note: function(taskCard) {
        const editor = taskCard.querySelector(".rich-text-editor-area");
        const content = editor?.innerHTML.trim() || "";
        if (!content) {
            showNotification("Введите текст заметки");
            return null;
        }
        return [{ content }];
    },

    true_false: function(taskCard) {
        const rows = [...taskCard.querySelectorAll(".statement-row")];
        if (!rows.length) {
            showNotification("Добавьте хотя бы одно утверждение");
            return null;
        }

        const tasks = [];
        for (const [index, row] of rows.entries()) {
            const statement = row.querySelector(".statement-text")?.value.trim();
            if (!statement) {
                showNotification(`Утверждение #${index + 1}: введите текст`);
                return null;
            }
            const is_true = row.querySelector(".statement-select")?.value === "true";
            tasks.push({ statement, is_true });
        }
        return tasks.length ? tasks : null;
    },

    fill_gaps: function(taskCard) {
        const editor = taskCard.querySelector(".rich-text-editor-area");
        const listType = taskCard.querySelector(".fill-gaps-type-select")?.value || "hidden";
        const text = editor?.innerHTML.trim() || "";

        if (!text) {
            showNotification("Введите текст с пропусками");
            return null;
        }

        const answers = [];
        const regex = /\[([^\]]+)\]/g;
        let match;
        while ((match = regex.exec(text)) !== null) answers.push(match[1]);

        if (!answers.length) {
            showNotification("Добавьте пропуски в тексте (например: [ответ])");
            return null;
        }

        return [{ text, answers, list_type: listType }];
    },

    match_cards: function(taskCard) {
        const rows = [...taskCard.querySelectorAll(".match-card-row")];
        if (rows.length < 2) {
            showNotification("Добавьте как минимум 2 пары карточек");
            return null;
        }

        const cards = [];
        const leftCards = new Set();
        const rightCards = new Set();

        for (const [index, row] of rows.entries()) {
            const card_left = row.querySelector(".card-left")?.value.trim();
            const card_right = row.querySelector(".card-right")?.value.trim();

            if (!card_left || !card_right) {
                showNotification(`Пара #${index + 1}: заполните обе карточки`);
                return null;
            }

            if (leftCards.has(card_left)) {
                showNotification(`Пара #${index + 1}: левая карточка "${card_left}" уже используется`);
                return null;
            }
            if (rightCards.has(card_right)) {
                showNotification(`Пара #${index + 1}: правая карточка "${card_right}" уже используется`);
                return null;
            }

            leftCards.add(card_left);
            rightCards.add(card_right);
            cards.push({ card_left, card_right });
        }

        return cards.length ? [{ cards }] : null;
    },

    text_input: function(taskCard) {
        const prompt = taskCard.querySelector(".task-prompt")?.value.trim() || "";
        const default_text = taskCard.querySelector(".rich-text-editor-area")?.innerHTML.trim() || "";

        if (!prompt) {
            showNotification("Введите заголовок задания");
            return null;
        }

        return [{ prompt, default_text }];
    },

    integration: function(taskCard) {
        const embedCodeEl = taskCard.querySelector("textarea");
        const embedCode = embedCodeEl?.value.trim() || "";

        if (!embedCode) {
            showNotification("Введите embed-код или ссылку");
            return null;
        }

        return [{ embed_code: embedCode }];
    },

    file: function(taskCard) {
        const input = taskCard.querySelector(".file-input");
        if (!input.files.length) {
            showNotification("Выберите файл");
            return null;
        }
        return [{ file: input.files[0] }];
    },

    word_list: function(taskCard) {
        const rows = [...taskCard.querySelectorAll(".word-translation-row")];
        if (rows.length < 2) {
            showNotification("Добавьте как минимум 2 пары слов");
            return null;
        }

        const words = [];
        const wordSet = new Set();
        const translationSet = new Set();

        for (const [index, row] of rows.entries()) {
            const word = row.querySelector(".word-input")?.value.trim();
            const translation = row.querySelector(".translation-input")?.value.trim();

            if (!word || !translation) {
                showNotification(`Пара #${index + 1}: заполните слово и перевод`);
                return null;
            }

            if (wordSet.has(word)) {
                showNotification(`Пара #${index + 1}: слово "${word}" уже используется`);
                return null;
            }
            if (translationSet.has(translation)) {
                showNotification(`Пара #${index + 1}: перевод "${translation}" уже используется`);
                return null;
            }

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
            let errorMessage = "Ошибка сохранения";

            if (result?.errors) {
                if (typeof result.errors === 'string') {
                    errorMessage = result.errors;
                } else if (typeof result.errors === 'object') {
                    const errorList = [];

                    for (const [field, errors] of Object.entries(result.errors)) {
                        if (Array.isArray(errors)) {
                            errors.forEach(errorText => {
                                errorList.push(`${errorText}`);
                            });
                        } else {
                            errorList.push(`${String(errors)}`);
                        }
                    }

                    errorMessage = errorList.join(', ');
                }
            }

            showNotification(errorMessage);
            console.error("Ошибка:", result?.errors);

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

