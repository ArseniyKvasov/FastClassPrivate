import { showNotification } from "/static/js/tasks/utils.js";

/**
 * Рендерит редактор задания типа «Интеграция».
 *
 * @param {{embed_code?: string}|null} taskData
 */
export function renderIntegrationTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    const embedCode = taskData?.embed_code || "";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0"><i class="bi bi-box-arrow-in-right me-1"></i> Интеграция</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="mb-3 position-relative">
            <label class="form-label d-flex align-items-center">
                Встроенный код
                <i class="bi bi-question-circle ms-2 text-primary embed-help-btn"
                   style="cursor: pointer;"
                   title="Где взять код?"></i>
            </label>
            <textarea class="form-control embed-code-input"
                      placeholder="Вставьте iframe-код (YouTube, Wordwall и др.)"
                      rows="4"
                      autocomplete="off">${embedCode}</textarea>
        </div>

        <div class="mb-3">
            <small class="text-muted">
                Поддерживаются:
                <span class="badge bg-light text-dark me-1">YouTube</span>
                <span class="badge bg-light text-dark me-1">Wordwall</span>
                <span class="badge bg-light text-dark me-1">Miro</span>
                <span class="badge bg-light text-dark me-1">Quizlet</span>
                <span class="badge bg-light text-dark me-1">LearningApps</span>
                <span class="badge bg-light text-dark me-1">Rutube</span>
                <span class="badge bg-light text-dark me-1">Sboard</span>
            </small>
        </div>

        <button class="btn btn-success w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    card.querySelector(".embed-help-btn")
        .addEventListener("click", showEmbedInstructions);

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => card.remove());

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}

/**
 * Показывает подсказку по получению embed-кода
 */
function showEmbedInstructions() {
    const instructions = `
        <div class="embed-instructions">
            <h6 class="fw-semibold mb-3">Как получить embed-код?</h6>
            <p class="mb-3">Вставьте embed-код (встроенный HTML) с одного из следующих ресурсов:</p>

            <div class="mb-3">
                <strong class="d-block mb-2">Виртуальная доска</strong>
                <ul class="small mb-0">
                    <li><strong>Miro:</strong> кнопка «Поделиться» → «Embed»</li>
                    <li><strong>Sboard:</strong> найдите кнопку «Поделиться» → «Встроить в Iframe» и скопируйте код доски</li>
                </ul>
            </div>

            <div class="mb-3">
                <strong class="d-block mb-2">Игры и интерактивные упражнения</strong>
                <ul class="small mb-0">
                    <li><strong>Wordwall:</strong> кнопка «Поделиться» → «Встраивание» → скопируйте HTML</li>
                    <li><strong>Quizlet:</strong> кнопка «Поделиться» → «Встроить»</li>
                    <li><strong>LearningApps:</strong> внизу под приложением есть кнопка «Встроить»</li>
                </ul>
            </div>

            <div class="mb-3">
                <strong class="d-block mb-2">Видео</strong>
                <ul class="small mb-0">
                    <li><strong>Rutube:</strong> кнопка «Поделиться» → «HTML-код»</li>
                    <li><strong>YouTube:</strong> кнопка «Поделиться» → «Встроить»</li>
                </ul>
            </div>

            <div class="alert alert-info small mt-3 mb-0">
                Вставляемый код должен начинаться с <code>&lt;iframe ...&gt;</code> и содержать ссылку на один из поддерживаемых сайтов.
            </div>
        </div>
    `;

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
}