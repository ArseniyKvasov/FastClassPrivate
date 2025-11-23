/**
 * Показывает подсказку по получению embed-кода
 */
function showEmbedInstructions() {
    const instructions = `
        <div class="embed-instructions">
            <h6 class="fw-semibold mb-3">Как получить embed-код?</h6>
            <p class="mb-3">Вставьте embed-код (встроенный HTML) с одного из следующих ресурсов:</p>

            <div class="mb-3">
                <strong class="d-block mb-2">🎯 Виртуальная доска</strong>
                <ul class="small mb-0">
                    <li><strong>Miro:</strong> кнопка «Поделиться» → «Embed»</li>
                    <li><strong>Sboard:</strong> найдите кнопку «Поделиться» → «Встроить в Iframe» и скопируйте код доски</li>
                </ul>
            </div>

            <div class="mb-3">
                <strong class="d-block mb-2">🎮 Игры и интерактивные упражнения</strong>
                <ul class="small mb-0">
                    <li><strong>Wordwall:</strong> кнопка «Поделиться» → «Встраивание» → скопируйте HTML</li>
                    <li><strong>Quizlet:</strong> кнопка «Поделиться» → «Встроить»</li>
                    <li><strong>LearningApps:</strong> внизу под приложением есть кнопка «Встроить»</li>
                </ul>
            </div>

            <div class="mb-3">
                <strong class="d-block mb-2">🎥 Видео</strong>
                <ul class="small mb-0">
                    <li><strong>Rutube:</strong> кнопка «Поделиться» → «HTML-код»</li>
                    <li><strong>YouTube:</strong> кнопка «Поделиться» → «Встроить»</li>
                </ul>
            </div>

            <div class="alert alert-info small mt-3 mb-0">
                💡 Вставляемый код должен начинаться с <code>&lt;iframe ...&gt;</code> и содержать ссылку на один из поддерживаемых сайтов.
            </div>
        </div>
    `;

    // Создаем модальное окно для подсказки
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Помощь по embed-коду</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    ${instructions}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Понятно</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    // Удаляем модальное окно после закрытия
    modal.addEventListener('hidden.bs.modal', function() {
        document.body.removeChild(modal);
    });
}

/**
 * Рендер редактора интеграции.
 * Если передан taskId — открывает модальное окно для редактирования.
 * taskData может содержать { embed_code: "код" }.
 */
function renderIntegrationTaskEditor(taskId = null, container = null, taskData = null) {
    const parent = container || document.getElementById("task-list");
    if (!parent) return;

    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    const embedCode = taskData?.embed_code || "";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Интеграция</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="mb-3 position-relative">
            <label class="form-label d-flex align-items-center">
                Встроенный код
                <i class="bi bi-question-circle ms-2 text-primary" style="cursor: pointer;" onclick="showEmbedInstructions()" title="Где взять код?"></i>
            </label>
            <textarea class="form-control" placeholder="Вставьте встроенный HTML-код, например с YouTube, Wordwall и др." rows="4" autocomplete="off">${embedCode}</textarea>
        </div>

        <div class="mb-3">
            <small class="text-muted">
                Поддерживаются:
                <span class="badge bg-light text-dark me-1"><i class="bi bi-youtube me-1 text-danger"></i>YouTube</span>
                <span class="badge bg-light text-dark me-1"><i class="bi bi-grid-3x3-gap-fill me-1 text-success"></i>Wordwall</span>
                <span class="badge bg-light text-dark me-1"><i class="bi bi-columns-gap me-1 text-info"></i>Miro</span>
                <span class="badge bg-light text-dark me-1"><i class="bi bi-lightbulb me-1 text-warning"></i>Quizlet</span>
                <span class="badge bg-light text-dark me-1"><i class="bi bi-app-indicator me-1 text-primary"></i>LearningApps</span>
                <span class="badge bg-light text-dark me-1"><i class="bi bi-film me-1 text-secondary"></i>Rutube</span>
                <span class="badge bg-light text-dark me-1"><i class="bi bi-pencil me-1 text-dark"></i>Sboard</span>
            </small>
        </div>

        <button class="btn btn-success w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => {
            if (taskId && bootstrapEditorModal) {
                bootstrapEditorModal.hide();
            } else {
                card.remove();
            }
        });

    card.querySelector(".save-btn")
        .addEventListener("click", () => saveTask("integration", card, taskId));

    if (taskId) {
        if (!editorModal) {
            editorModal = document.createElement("div");
            editorModal.className = "modal fade";
            editorModal.tabIndex = -1;
            editorModal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content p-3"></div>
                </div>
            `;
            document.body.appendChild(editorModal);
            bootstrapEditorModal = new bootstrap.Modal(editorModal);
        }
        const contentEl = editorModal.querySelector(".modal-content");
        contentEl.innerHTML = "";
        contentEl.appendChild(card);
        bootstrapEditorModal.show();
        return;
    }

    if (container) {
        parent.innerHTML = "";
        parent.appendChild(card);
    } else {
        parent.appendChild(card);
    }

    card.scrollIntoView({ behavior: "smooth", block: "center" });
}