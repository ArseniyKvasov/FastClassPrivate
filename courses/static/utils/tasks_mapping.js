const TASK_RENDERERS = {
    image: renderImageTask,
    fill_gaps: renderFillGapsTask,
    note: renderNoteTask,
    test: renderTestTask,
    true_false: renderTrueFalseTask,
    match_cards: renderMatchCardsTask,
    text_input: renderTextInputTask,
    integration: renderIntegrationTask
};

const interactiveTasks = ["test", "true_false", "fill_gaps", "match_cards", "text_input"]

const taskListContainer = document.getElementById("task-list");

const loader = document.createElement("div");
loader.className = "loader-overlay";
loader.innerHTML = `<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Загрузка...</span></div>`;
document.body.appendChild(loader);

function renderTaskCard(task, replaceExisting = false) {
    const card = document.createElement("div");
    card.className = "task-card mb-3 p-2 rounded-3 position-relative overflow-hidden";
    card.dataset.taskId = task.task_id;
    card.dataset.taskType = task.task_type;

    const contentContainer = document.createElement("div");
    contentContainer.className = "task-content";
    contentContainer.innerHTML = `<span class="text-secondary">Загрузка...</span>`;
    card.appendChild(contentContainer);

    if (typeof isAdmin !== "undefined" && isAdmin) {
        const adminPanel = document.createElement("div");
        adminPanel.className = "admin-panel position-absolute top-0 end-0 m-2 p-1 d-flex gap-1 align-items-center rounded-3 shadow-sm bg-white opacity-0 transition-opacity";
        adminPanel.style.zIndex = "10";

        const editBtn = document.createElement("button");
        editBtn.className = "btn btn-sm p-1 border-0 bg-transparent";
        editBtn.innerHTML = `<i class="bi bi-pencil"></i>`;
        editBtn.title = "Редактировать";
        editBtn.onclick = () => editTaskCard(card, task.data);
        adminPanel.appendChild(editBtn);

        try {
            if (isClassroom && interactiveTasks.includes(task.task_type)) {
                const resetBtn = document.createElement("button");
                resetBtn.className = "btn btn-sm p-1 border-0 bg-transparent text-warning";
                resetBtn.innerHTML = `<i class="bi bi-arrow-clockwise"></i>`;
                resetBtn.title = "Сбросить ответы";
                resetBtn.onclick = async () => resetStudentAnswers(task.task_id);
                adminPanel.appendChild(resetBtn);
            }
        } catch (err) {
            console.warn("Не удалось отобразить resetBtn");
        }

        const removeBtn = document.createElement("button");
        removeBtn.className = "btn btn-sm p-1 border-0 bg-transparent text-danger";
        removeBtn.innerHTML = `<i class="bi bi-trash"></i>`;
        removeBtn.title = "Удалить";
        removeBtn.onclick = async () => {
            const confirmed = await confirmAction("Вы уверены, что хотите удалить это задание?");
            if (!confirmed) return;
            try {
                const response = await fetch("/courses/delete-task/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCsrfToken()
                    },
                    body: JSON.stringify({ task_id: task.task_id })
                });
                const result = await response.json();
                if (result.success) {
                    card.remove();
                    showNotification("✅ Задание успешно удалено");
                } else {
                    showNotification(`❌ Ошибка: ${result.errors}`);
                }
            } catch (e) {
                console.error(e);
                showNotification("❌ Не удалось удалить задание. Попробуйте ещё раз.");
            }
        };
        adminPanel.appendChild(removeBtn);

        card.appendChild(adminPanel);

        card.addEventListener("mouseenter", () => adminPanel.classList.add("opacity-100"));
        card.addEventListener("mouseleave", () => adminPanel.classList.remove("opacity-100"));
    }

    try {
        const renderer = TASK_RENDERERS[task.task_type];
        if (renderer) {
            contentContainer.innerHTML = "";
            renderer(task, contentContainer);
            if (isClassroom) {
                attachTaskHandler(contentContainer, task);
            }
        } else {
            contentContainer.innerHTML = "<span class='text-danger'>Не удалось отобразить задание.</span>";
        }
    } catch (e) {
        console.error(e);
        contentContainer.innerHTML = "<span class='text-danger'>Не удалось отобразить задание.</span>";
    }

    if (replaceExisting) {
        const existing = taskListContainer.querySelector(`[data-task-id="${task.task_id}"]`);
        if (existing) {
            existing.replaceWith(card);
            return;
        }
    }

    taskListContainer.appendChild(card);
}

document.addEventListener("DOMContentLoaded", () => {
    loadSectionTasks(sectionId);
});

async function loadSectionTasks(sectionId) {
    if (!taskListContainer || !sectionId) return;

    const currentSelected = document.querySelector('#section-list .section-link.fw-bold');
    if (currentSelected && currentSelected.dataset.sectionId === sectionId) return;

    document.querySelectorAll('#section-list .section-link').forEach(btn => {
        if (btn.dataset.sectionId === sectionId) {
            btn.classList.add('fw-bold', 'text-primary');
        } else {
            btn.classList.remove('fw-bold', 'text-primary');
        }
    });

    taskListContainer.innerHTML = "";
    loader.style.display = "flex";

    try {
        const tasks = await fetchSectionTasks(sectionId);
        if (Array.isArray(tasks)) {
            tasks.forEach(task => renderTaskCard(task));
        }
        if (isClassroom) {
            try {
                const data = await fetchSectionAnswers(sectionId);

                if (!data || !Array.isArray(data.answers)) {
                    showNotification("Нет данных для отображения.");
                    return;
                }

                data.answers.forEach(answerData => {
                    const { task_id, task_type, answer } = answerData;

                    const container = document.querySelector(`[data-task-id="${task_id}"]`);
                    if (!container) {
                        console.warn(`Контейнер не найден для task_id: ${task_id}`);
                        return;
                    }

                    const handler = answerHandlers[task_type];
                    if (typeof handler === "function") {
                        try {
                            handler(answerData);
                        } catch (error) {
                            console.warn(`Ошибка в обработчике для task_type ${task_type}, task_id ${task_id}:`, error);
                            showNotification("Не удалось отобразить ответ.");
                        }
                    } else {
                        console.warn(`Не найден обработчик для типа задания: ${task_type}`);
                        showNotification("Не удалось отобразить ответ.");
                    }
                });

            } catch (error) {
                console.warn("Ошибка в handleSectionAnswers:", error);
                showNotification("Не удалось загрузить ответы раздела.");
            }
        } else {
            console.warn('Ответы не загружены, так как пользователь находится вне режима виртуального класса.');
        }
    } catch (e) {
        console.error(e);
        showNotification('Ошибка при загрузке заданий');
    } finally {
        loader.style.display = "none";
    }
}

