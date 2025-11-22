const TASK_TYPES = [
    { type: "test", label: "Тест", icon: "bi-check-circle" },
    { type: "note", label: "Заметка", icon: "bi-sticky" },
    { type: "image", label: "Картинка", icon: "bi-image" },
    { type: "true_false", label: "Правда или ложь", icon: "bi-check" },
    { type: "fill_gaps", label: "Заполнить пропуски", icon: "bi-pen" },
    { type: "match_cards", label: "Соотнеси слова", icon: "bi-arrow-left-right" },
    { type: "text_input", label: "Ввод текста", icon: "bi-text-paragraph" }
];

const taskTypeHandlers = {
    test:       (taskId, container, taskData) => renderTestTaskEditor?.(taskId, container, taskData),
    note:       (taskId, container, taskData) => renderNoteTaskEditor?.(taskId, container, taskData),
    image:      (taskId, container, taskData) => renderImageTaskEditor?.(taskId, container, taskData),
    true_false: (taskId, container, taskData) => renderTrueFalseTaskEditor?.(taskId, container, taskData),
    fill_gaps:  (taskId, container, taskData) => renderFillGapsTaskEditor?.(taskId, container, taskData),
    match_cards:(taskId, container, taskData) => renderMatchCardsTaskEditor?.(taskId, container, taskData),
    text_input: (taskId, container, taskData) => renderTextInputTaskEditor?.(taskId, container, taskData)
};

let selectorModal = null;
let bootstrapModal = null;
let editorModal = null;
let bootstrapEditorModal = null;
const sectionList = document.getElementById('section-list');
const sectionModal = new bootstrap.Modal(document.getElementById('manualSectionModal'));

function ensureSelectorModal() {
    if (selectorModal && bootstrapModal) return;
    selectorModal = document.getElementById("taskSelectorModal");
    if (!selectorModal) return;
    bootstrapModal = new bootstrap.Modal(selectorModal);
}

function createTaskTypeSelector() {
    ensureSelectorModal();
    if (!selectorModal) return;

    const container = document.getElementById("taskTypeSelectorContainer");
    if (!container) return;

    container.innerHTML = "";
    TASK_TYPES.forEach(item => {
        const col = document.createElement("div");
        col.className = "col-6 col-md-4 col-lg-3 d-flex";
        col.innerHTML = `
            <div class="flex-fill text-center rounded-4 px-2 py-3 bg-white task-type-option"
                 data-type="${item.type}"
                 style="cursor: pointer; transition:transform 0.15s, background-color 0.15s;">
                <i class="bi ${item.icon} fs-3 text-primary mb-2"></i>
                <h6 class="mb-0 text-dark small fw-medium">${item.label}</h6>
            </div>
        `;
        container.appendChild(col);
    });

    // Делегирование кликов
    function onClick(e) {
        const option = e.target.closest(".task-type-option");
        if (!option) return;
        const type = option.dataset.type;
        const handler = taskTypeHandlers[type];
        if (!handler) return;

        // Удаляем все открытые редакторы и закрываем модалку
        document.querySelectorAll(".task-editor-card").forEach(el => el.remove());
        bootstrapModal.hide();

        handler(); // открываем редактор создания (без taskId)
    }

    container.removeEventListener("click", onClick); // безопасно удалить перед добавлением
    container.addEventListener("click", onClick);
    bootstrapModal.show();
}

function editTaskCard(taskCard, taskData) {
    if (!taskCard) return;
    const taskType = taskCard.dataset.taskType;
    const handler = taskTypeHandlers[taskType];
    if (!handler) return;

    const existingEditor = taskCard.querySelector(".task-editor-card");
    if (existingEditor) existingEditor.remove();

    const taskId = taskCard.dataset.taskId;
    handler(taskId, taskCard, taskData);
}

const addTaskBtn = document.getElementById("add-task-btn");
if (addTaskBtn) addTaskBtn.addEventListener("click", () => createTaskTypeSelector());

function closeTaskEditor() {
    const modalEl = document.querySelector(".modal.show .task-editor-card");
    if (modalEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalEl.closest(".modal"));
        if (modalInstance) modalInstance.hide();
        return;
    }

    const editor = document.querySelector(".task-editor-card");
    if (editor) {
        editor.remove();
    }

    const form = document.querySelector("#taskEditorForm");
    if (form && form.reset) form.reset();

    document.querySelectorAll(".task-card.editing").forEach(el => el.classList.remove("editing"));
}

const TaskValidators = {
    test: function(taskCard) {
        const blocks = [...taskCard.querySelectorAll(".question-container")];
        if (!blocks.length) { showNotification("❌ Добавьте хотя бы один вопрос!"); return null; }

        const tasks = [];
        for (const block of blocks) {
            const question = block.querySelector(".question-text")?.value.trim();
            if (!question) { showNotification("❌ Укажите текст вопроса!"); return null; }

            const options = [...block.querySelectorAll(".answer-row")].map(row => {
                const option = row.querySelector(".answer-text")?.value.trim();
                const is_correct = !!row.querySelector(".correct-answer-checkbox")?.checked;
                return option ? { option, is_correct } : null;
            }).filter(Boolean);

            if (!options.length) { showNotification("❌ Укажите хотя бы один вариант ответа!"); return null; }
            if (!options.some(o => o.is_correct)) { showNotification("❌ Хотя бы один вариант должен быть отмечен как правильный!"); return null; }

            tasks.push({ question, options });
        }
        return tasks;
    },

    note: function(taskCard) {
        const editor = taskCard.querySelector(".note-editor");
        const content = editor?.innerHTML.trim() || "";
        if (!content) { showNotification("❌ Добавьте текст заметки!"); return null; }
        return [{ content }];
    },

    image: function(taskCard) {
        const input = taskCard.querySelector(".image-input");
        const preview = taskCard.querySelector(".preview-img");

        if (!input?.files?.length && !preview?.src) {
            showNotification("❌ Добавьте изображение!");
            return null;
        }

        const file = input.files[0] || null; // null - если изображение не изменилось при редактировании
        const caption = taskCard.querySelector(".caption-input")?.value.trim() || "";

        const allowed = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
        if (file && !allowed.includes(file.type)) {
            showNotification("❌ Неподдерживаемый формат изображения");
            return null;
        }

        const maxSizeMB = 5;
        if (file && file.size > maxSizeMB * 1024 * 1024) {
            showNotification(`❌ Изображение не должно превышать ${maxSizeMB} МБ`);
            return null;
        }

        return [{ file, caption }];
    },

    true_false: function(taskCard) {
        const rows = [...taskCard.querySelectorAll(".statement-row")];
        if (!rows.length) { showNotification("❌ Добавьте хотя бы одно утверждение!"); return null; }

        const tasks = [];
        for (const row of rows) {
            const statement = row.querySelector(".statement-text")?.value.trim();
            if (!statement) { showNotification("❌ Укажите текст утверждения!"); return null; }
            const is_true = row.querySelector(".statement-select")?.value === "true";
            tasks.push({ statement, is_true });
        }
        return tasks;
    },

    fill_gaps: function(taskCard) {
        const editor = taskCard.querySelector(".fill-text-editor");
        const text = editor?.innerHTML.trim() || "";
        if (!text) { showNotification("❌ Введите текст задания!"); return null; }

        const answers = [];
        const regex = /\[([^\]]+)\]/g;
        let match;
        while ((match = regex.exec(text)) !== null) answers.push(match[1]);

        if (!answers.length) { showNotification("❌ Добавьте хотя бы один пропуск в квадратных скобках"); return null; }

        return [{ text, answers, task_type: "hidden" }];
    },

    match_cards: function(taskCard) {
        const rows = [...taskCard.querySelectorAll(".match-card-row")];
        if (rows.length < 2) { showNotification("❌ Добавьте как минимум две пары карточек!"); return null; }

        const cards = [];
        for (const row of rows) {
            const card_left = row.querySelector(".card-left")?.value.trim();
            const card_right = row.querySelector(".card-right")?.value.trim();
            if (!card_left || !card_right) { showNotification("❌ Каждая карточка должна содержать левую и правую части!"); return null; }
            cards.push({ card_left, card_right });
        }
        return [{ cards }];
    },

    text_input: function(taskCard) {
        const promptEl = taskCard.querySelector(".task-prompt");
        const defaultEl = taskCard.querySelector(".task-default-text");
        const prompt = promptEl?.value.trim() || "";
        const default_text = defaultEl?.value || "";
        if (!prompt) { showNotification("❌ Введите текст задания!"); return null; }
        return [{ prompt, default_text }];
    }
};

async function saveTask(taskType, taskCard, taskId = null) {
    if (typeof sectionId === "undefined" || !sectionId) {
        showNotification("Произошла ошибка. Вы не можете создавать задания.");
        return null;
    }

    const data = TaskValidators[taskType]?.(taskCard);
    if (!data) return null;

    try {
        let body;
        let headers = { "X-CSRFToken": getCsrfToken() };

        if (taskType === "image") {
            const fileObj = data[0];
            body = new FormData();
            body.append("task_type", taskType);
            body.append("section_id", sectionId);
            if (taskId) body.append("task_id", taskId);
            body.append("image", fileObj.file);
            body.append("caption", fileObj.caption || "");
        } else {
            body = JSON.stringify({
                task_type: taskType,
                task_id: taskId,
                section_id: sectionId,
                data
            });
            headers["Content-Type"] = "application/json";
        }

        const res = await fetch("/courses/save-task/", {
            method: "POST",
            headers,
            body
        });

        const result = await res.json();

        if (!result.success) {
            showNotification("Ошибка сохранения: см. консоль");
            console.error(result.errors);
            return null;
        }

        const replaceExisting = !!taskId;

        if (result.task_id) {
            try {
                const savedTask = await fetchSingleTask(result.task_id);
                if (savedTask) renderTaskCard(savedTask, replaceExisting);
                if (isClassroom) {
                    try {
                        if (typeof fetchSectionAnswers === 'function') {
                            await handleSectionAnswers(sectionId);
                        } else {
                            console.warn('Функция fetchSectionAnswers не найдена');
                        }
                    } catch (error) {
                        console.error('Ошибка при вызове fetchSectionAnswers:', error);
                    }
                } else {
                    console.warn('Ответы не загружены, так как пользователь находится вне режима виртуального класса.');
                }

                showNotification("Задание сохранено!");
                closeTaskEditor?.();
            } catch (err) {
                console.error(`Ошибка при загрузке задания ${result.task_id}:`, err);
            }
        } else {
            console.warn("Ответ не содержит заданий:", result);
        }

        return result.task_id || (result.tasks?.[0]?.task_id) || null;
    } catch (err) {
        console.error(err);
        showNotification("Ошибка сети");
        return null;
    }
}




        // Создание и редактирование разделов

const addSectionBtn = document.getElementById('add-section-btn');
const saveSectionBtn = document.getElementById('saveManualSection');

addSectionBtn.addEventListener('click', () => {
    const nameInput = document.getElementById('manualSectionName');
    nameInput.value = '';

    // Переводим модалку к режиму создания
    saveSectionBtn.dataset.action = 'create';
    saveSectionBtn.dataset.sectionId = '';
    document.getElementById('saveManualSectionText').textContent = 'Создать';
    document.getElementById('saveManualSectionIcon').className = 'bi bi-plus-circle';
    document.getElementById('manualSectionModalLabel').textContent = 'Новый раздел';

    sectionModal.show();

    setTimeout(() => nameInput.focus(), 500);
});

async function createSection(title) {
    try {
        const response = await fetch(`/courses/section/create/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                lesson_id: lessonId,
                title: title
            })
        });

        if (!response.ok) {
            let errorMessage = 'Ошибка при создании раздела';
            try {
                const errorData = await response.json();
                if (errorData.error) errorMessage = errorData.error;
            } catch (e) {}
            throw new Error(errorMessage);
        }

        const data = await response.json();

        // вызываем рендер
        renderSectionItem(data);

        showNotification('Раздел успешно создан');

        // Автоматически загружаем задачи нового раздела
        loadSectionTasks(data.id);

    } catch (error) {
        console.error(error);
        showNotification(error.message || 'Произошла неизвестная ошибка');
    }
}

saveSectionBtn.addEventListener('click', async () => {
    const title = document.getElementById('manualSectionName').value.trim();
    if (!title) {
        showNotification('Введите название раздела');
        return;
    }

    const action = saveSectionBtn.dataset.action;
    const sectionId = saveSectionBtn.dataset.sectionId;

    if (action === 'edit') {
        await editSection(sectionId, title);
        sectionModal.hide();
        return;
    }

    // Создание
    await createSection(title);
    sectionModal.hide();
});

async function editSection(sectionId, newTitle) {
    try {
        const response = await fetch(`/courses/section/edit/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                section_id: sectionId,
                title: newTitle
            })
        });

        if (!response.ok) {
            let message = 'Ошибка при редактировании раздела';
            try {
                const data = await response.json();
                if (data.error) message = data.error;
            } catch {}
            throw new Error(message);
        }

        const data = await response.json();

        const button = document.querySelector(
            `.section-link[data-section-id="${sectionId}"]`
        );
        if (button) button.textContent = data.title;

        showNotification('Название раздела обновлено');
    } catch (error) {
        console.error(error);
        showNotification(error.message || 'Ошибка при редактировании');
    }
}

async function deleteSection(sectionId) {
    try {
        const confirmed = await confirmAction('Удалить этот раздел?');
        if (!confirmed) return;

        const response = await fetch(`/courses/section/delete/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ section_id: sectionId })
        });

        if (!response.ok) {
            let message = 'Ошибка при удалении раздела';
            try {
                const data = await response.json();
                if (data.error) message = data.error;
            } catch {}
            throw new Error(message);
        }

        document.querySelector(`[data-section-id="${sectionId}"]`).remove();
        showNotification('Раздел удалён');
    } catch (error) {
        console.error(error);
        showNotification(error.message || 'Не удалось удалить раздел');
    }
}

sectionList.addEventListener('click', async (event) => {
    const li = event.target.closest('li[data-section-id]');
    if (!li) return;

    sectionId = li.dataset.sectionId;

    const editBtn = event.target.closest('.edit-section-button');
    const deleteBtn = event.target.closest('.delete-btn');

    if (deleteBtn) {
        await deleteSection(sectionId);
        return;
    }

    if (editBtn) {
        const sectionName = li.querySelector('.section-link')?.textContent.trim();

        document.getElementById('manualSectionName').value = sectionName;
        saveSectionBtn.dataset.sectionId = sectionId;
        saveSectionBtn.dataset.action = 'edit';
        document.getElementById('saveManualSectionText').textContent = 'Сохранить';
        document.getElementById('saveManualSectionIcon').className = 'bi bi-save';

        document.getElementById('manualSectionModalLabel').textContent = 'Редактирование';

        sectionModal.show();
        return;
    }

    // --- Выбор раздела по клику на карточку или текст
    loadSectionTasks(sectionId);
});
