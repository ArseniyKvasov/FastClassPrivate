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
taskListContainer.appendChild(loader);

function renderTaskCard(task, replaceExisting = false) {
    const card = document.createElement("div");
    card.className = "task-card mb-3 p-2 rounded-3 position-relative overflow-hidden";
    card.dataset.taskId = task.task_id;
    card.dataset.taskType = task.task_type;

    const contentContainer = document.createElement("div");
    contentContainer.className = "task-content";
    contentContainer.innerHTML = `<span class="text-secondary">Загрузка...</span>`;
    card.appendChild(contentContainer);

    try {
        const renderer = TASK_RENDERERS[task.task_type];
        if (renderer) {
            contentContainer.innerHTML = "";
            renderer(task, contentContainer);
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
    } catch (e) {
        console.error(e);
        showNotification('Ошибка при загрузке заданий');
    } finally {
        loader.style.display = "none";
    }
}

