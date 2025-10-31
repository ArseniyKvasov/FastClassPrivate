const TASK_TYPES = [
    { type: "test", label: "Тест", icon: "bi-check-circle" },
    { type: "note", label: "Заметка", icon: "bi-sticky" },
    { type: "image", label: "Картинка", icon: "bi-image" },
    { type: "true_false", label: "Правда или ложь", icon: "bi-check" },
    { type: "fill_gaps", label: "Заполнить пропуски", icon: "bi-pen" },
    { type: "match_pairs", label: "Соотнеси слова", icon: "bi-arrow-left-right" },
    { type: "text_input", label: "Ввод текста", icon: "bi-text-paragraph" }
];

const taskTypeHandlers = {
    test: (nextTaskId) => renderTestTaskEditor(nextTaskId),
    note: (nextTaskId) => renderNoteTaskEditor(nextTaskId),
    image: (nextTaskId) => renderImageTaskEditor(nextTaskId),
    true_false: (nextTaskId) => renderTrueFalseTaskEditor(nextTaskId),
    fill_gaps: (nextTaskId) => renderFillGapsTaskEditor(nextTaskId),
    match_pairs: (nextTaskId) => renderMatchCardsTaskEditor(nextTaskId),
    text_input: (nextTaskId) => renderTextInputTaskEditor(nextTaskId)
};


let selectorModal = null;
let bootstrapModal = null;


function createTaskTypeSelector(nextTaskId = null) {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;

    if (!selectorModal) {
        selectorModal = document.getElementById('taskSelectorModal');
        bootstrapModal = new bootstrap.Modal(selectorModal);
    }

    const container = document.getElementById('taskTypeSelectorContainer');
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

    container.addEventListener("click", function handleClick(e) {
        const option = e.target.closest(".task-type-option");
        if (!option) return;

        const type = option.dataset.type;
        const handler = taskTypeHandlers[type];

        if (handler) {
            const existingEditors = document.querySelectorAll(".task-editor-card");
            existingEditors.forEach(editor => editor.remove());

            bootstrapModal.hide();
            handler(nextTaskId);
        }

        container.removeEventListener("click", handleClick);
    });

    bootstrapModal.show();
}


document.getElementById('add-task-btn').addEventListener("click", () => {
    createTaskTypeSelector();
});

function generateId(prefix = "id") {
    return prefix + "-" + Math.random().toString(36).substr(2, 9);
}

const TaskValidators = {
    test: function(taskCard) {
        const questionBlocks = [...taskCard.querySelectorAll(".question-container")];
        if (!questionBlocks.length) {
            showNotification("❌ Добавьте хотя бы один вопрос!");
            return null;
        }

        const tasks = [];

        for (const block of questionBlocks) {
            const question = block.querySelector(".question-text")?.value.trim();
            if (!question) {
                showNotification("❌ Укажите текст вопроса!");
                return null;
            }

            const options = [...block.querySelectorAll(".answer-row")].map(row => {
                const option = row.querySelector(".answer-text")?.value.trim();
                const is_correct = row.querySelector(".correct-answer-checkbox")?.checked || false;
                return option ? { option, is_correct } : null;
            }).filter(Boolean);

            if (!options.length) {
                showNotification("❌ Укажите хотя бы один вариант ответа!");
                return null;
            }

            if (!options.some(o => o.is_correct)) {
                showNotification("❌ Хотя бы один вариант должен быть отмечен как правильный!");
                return null;
            }

            tasks.push({ question, options });
        }

        return tasks;
    },

    note: function(taskCard) {
        const editor = taskCard.querySelector(".note-editor");
        const content = editor?.innerHTML.trim() || "";
        if (!content) {
            showNotification("❌ Добавьте текст заметки!");
            return null;
        }

        return [{ content }];
    },

    image: function(taskCard) {
        const input = taskCard.querySelector(".image-input");
        if (!input?.files?.length) {
            showNotification("❌ Добавьте изображение!");
            return null;
        }

        const file = input.files[0];
        const caption = taskCard.querySelector(".image-caption")?.value.trim() || "";

        const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp"];
        if (!allowed.includes(file.type)) {
            showNotification("❌ Неподдерживаемый формат изображения");
            return null;
        }

        const maxSizeMB = 5;
        if (file.size > maxSizeMB * 1024 * 1024) {
            showNotification(`❌ Изображение не должно превышать ${maxSizeMB} МБ`);
            return null;
        }

        return [{ file, caption }];
    },

    true_false: function(taskCard) {
        const rows = [...taskCard.querySelectorAll(".statement-row")];
        if (!rows.length) {
            showNotification("❌ Добавьте хотя бы одно утверждение!");
            return null;
        }

        const tasks = [];

        for (const row of rows) {
            const statement = row.querySelector(".statement-text")?.value.trim();
            if (!statement) {
                showNotification("❌ Укажите текст утверждения!");
                return null;
            }

            const is_true = row.querySelector(".statement-select")?.value === "true";
            tasks.push({ statement, is_true });
        }

        return tasks;
    },

    fill_gaps: function(taskCard) {
        const textEl = taskCard.querySelector(".fill-text-input");
        const typeEl = taskCard.querySelector(".fill-type-select");
        const text = textEl?.value.trim() || "";

        if (!text) {
            showNotification("❌ Введите текст задания!");
            return null;
        }

        const answers = [];
        const regex = /\[([^\]]+)\]/g;
        let match;

        while ((match = regex.exec(text)) !== null) {
            answers.push(match[1]);
        }

        if (!answers.length) {
            showNotification("❌ Добавьте хотя бы один пропуск в квадратных скобках");
            return null;
        }

        const task_type = typeEl?.value || "open";
        return [{ text, answers, task_type }];
    },
    match_cards: function(taskCard) {
        const rows = [...taskCard.querySelectorAll(".match-card-row")];
        if (rows.length < 2) {
            showNotification("❌ Добавьте как минимум две пары карточек!");
            return null;
        }

        const cards = [];

        for (const row of rows) {
            const card_left = row.querySelector(".card-left")?.value.trim();
            const card_right = row.querySelector(".card-right")?.value.trim();

            if (!card_left || !card_right) {
                showNotification("❌ Каждая карточка должна содержать левую и правую части!");
                return null;
            }

            cards.push({ card_left, card_right });
        }

        return [{ cards }];
    },
    text_input: function(taskCard) {
        const promptEl = taskCard.querySelector(".task-prompt");
        const defaultEl = taskCard.querySelector(".task-default-text");

        const prompt = promptEl?.value.trim() || "";
        const defaultText = defaultEl?.value || "";

        if (!prompt) {
            showNotification("❌ Введите текст задания!");
            return null;
        }

        return [{ prompt, default_text: defaultText }];
    },
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

        console.log("[DEBUG]: ", taskType);

        if (taskType === "image") {
            const fileObj = data[0];
            body = new FormData();
            body.append("task_type", taskType);
            body.append("section_id", sectionId);
            if (taskId) body.append("task_id", taskId);
            body.append("image", fileObj.file);
            body.append("caption", fileObj.caption || "");
        } else {
            body = JSON.stringify({ task_type: taskType, task_id: taskId, section_id: sectionId, data });
            headers["Content-Type"] = "application/json";
        }

        const res = await fetch("/courses/save-task/", {
            method: "POST",
            headers,
            body
        });

        const result = await res.json();

        if (!result.success) {
            showNotification("❌ Ошибка сохранения: см. консоль");
            console.error(result.errors);
            return null;
        }

        showNotification("✅ Задача сохранена!");
        return result.task_id;
    } catch (err) {
        console.error(err);
        showNotification("❌ Ошибка сети");
        return null;
    }
}



