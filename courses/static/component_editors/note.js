function renderNoteTaskEditor(nextTaskId = null) {
    const taskList = document.getElementById("task-list");
    if (!taskList) return;

    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border rounded";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Текстовая заметка</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="toolbar mb-2 d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-light border format-btn" data-cmd="bold" title="Жирный">
                <i class="bi bi-type-bold"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="italic" title="Курсив">
                <i class="bi bi-type-italic"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="underline" title="Подчеркнутый">
                <i class="bi bi-type-underline"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="insertUnorderedList" title="Маркированный список">
                <i class="bi bi-list-ul"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="insertOrderedList" title="Нумерованный список">
                <i class="bi bi-list-ol"></i>
            </button>
            <button class="btn btn-sm btn-light border clear-format-btn" title="Сбросить стили">
                <i class="bi bi-eraser"></i>
            </button>
        </div>

        <div class="note-editor border rounded p-2" 
             contenteditable="true" 
             style="min-height: 160px; outline: none;">
        </div>

        <button class="btn btn-success mt-3 w-100 fw-semibold">
            Сохранить
        </button>
    `;

    const editor = card.querySelector(".note-editor");

    card.querySelectorAll(".format-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const cmd = btn.dataset.cmd;
            document.execCommand(cmd, false, null);
            editor.focus();
        });
    });

    card.querySelector(".clear-format-btn")
        .addEventListener("click", () => {
            const html = editor.innerText;
            editor.innerHTML = html;
            editor.focus();
        });

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => card.remove());

    card.querySelector(".btn-success")
        .addEventListener("click", () => saveTask("note", card));

    if (nextTaskId) {
        const nextEl = document.querySelector(`[data-task-id="${nextTaskId}"]`);
        if (nextEl) {
            taskList.insertBefore(card, nextEl);
            return;
        }
    }

    taskList.appendChild(card);
    card.scrollIntoView({ behavior: "smooth", block: "center" });
}

