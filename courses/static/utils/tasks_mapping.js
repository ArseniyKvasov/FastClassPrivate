import { renderImageTask } from '/static/component_display/image.js';
import { renderFillGapsTask } from '/static/component_display/fillgaps.js';
import { renderNoteTask } from '/static/component_display/note.js';
import { renderTestTask } from '/static/component_display/test.js';
import { renderTrueFalseTask } from '/static/component_display/truefalse.js';
import { renderMatchCardsTask } from '/static/component_display/match.js';
import { renderTextInputTask } from '/static/component_display/textinput.js';

const TASK_RENDERERS = {
    image: renderImageTask,
    fill_gaps: renderFillGapsTask,
    note: renderNoteTask,
    test: renderTestTask,
    true_false: renderTrueFalseTask,
    match_cards: renderMatchCardsTask,
    text_input: renderTextInputTask,
};

const taskListContainer = document.getElementById("task-list");

const loader = document.createElement("div");
loader.className = "loader-overlay";
loader.innerHTML = `<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Загрузка...</span></div>`;
document.body.appendChild(loader);

async function fetchTasks() {
    if (typeof sectionId === "undefined" || !sectionId) {
        showNotification("Произошла ошибка. Невозможно загрузить задания.");
        throw new Error("sectionId не определен");
    }

    try {
        const res = await fetch(`/courses/get-tasks/${sectionId}/`);
        const data = await res.json();

        if (!data.success) {
            showNotification(`❌ Ошибка: ${data.errors}`);
            return [];
        }

        return data.tasks;
    } catch (err) {
        console.error(err);
        showNotification("❌ Ошибка сети при загрузке заданий");
        return [];
    }
}

function renderTaskCard(task) {
    const card = document.createElement("div");
    card.className = "task-card mb-3 p-2 rounded-3 position-relative overflow-hidden";
    card.dataset.taskId = task.task_id;
    card.dataset.taskType = task.task_type;

    // Контент задания
    const contentContainer = document.createElement("div");
    contentContainer.className = "task-content";
    contentContainer.innerHTML = `<span class="text-secondary">Загрузка...</span>`;
    card.appendChild(contentContainer);

    // Админская панель
    if (isAdmin) {
        const adminPanel = document.createElement("div");
        adminPanel.className = "admin-panel position-absolute top-0 end-0 m-2 p-1 d-flex gap-1 align-items-center rounded-3 shadow-sm bg-white opacity-0 transition-opacity";
        adminPanel.style.zIndex = "10"; // поверх карточки

        const editBtn = document.createElement("button");
        editBtn.className = "btn btn-sm p-1 border-0 bg-transparent";
        editBtn.innerHTML = `<i class="bi bi-pencil"></i>`;
        editBtn.title = "Редактировать";
        editBtn.onclick = () => console.log("Редактируем", task.task_id);

        const removeBtn = document.createElement("button");
        removeBtn.className = "btn btn-sm p-1 border-0 bg-transparent text-danger";
        removeBtn.innerHTML = `<i class="bi bi-trash"></i>`;
        removeBtn.title = "Удалить";
        removeBtn.onclick = async () => {
            const confirmed = await confirmAction("Вы уверены, что хотите удалить это задание?");
            console.log("Подтверждено:", confirmed);
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

        adminPanel.appendChild(editBtn);
        adminPanel.appendChild(removeBtn);
        card.appendChild(adminPanel);

        // Появление панели при наведении
        card.addEventListener("mouseenter", () => adminPanel.classList.add("opacity-100"));
        card.addEventListener("mouseleave", () => adminPanel.classList.remove("opacity-100"));
    }

    // Рендер задания через соответствующий renderer
    try {
        const renderer = TASK_RENDERERS[task.task_type];
        if (renderer) {
            contentContainer.innerHTML = "";
            renderer(task.data, contentContainer);
        } else {
            contentContainer.innerHTML = "<span class='text-danger'>Не удалось отобразить задание.</span>";
        }
    } catch (e) {
        console.error(e);
        contentContainer.innerHTML = "<span class='text-danger'>Не удалось отобразить задание.</span>";
    }

    taskListContainer.appendChild(card);
}



document.addEventListener("DOMContentLoaded", async () => {
    loader.style.display = "flex";

    if (!taskListContainer) return;

    const tasks = await fetchTasks();

    tasks.forEach(task => renderTaskCard(task));

    loader.style.display = "none";
});
