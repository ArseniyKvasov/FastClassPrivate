import { showNotification } from "/static/js/tasks/utils.js";

/**
 * Рендерит редактор задания типа «Файл».
 *
 * @param {{file_url?: string}|null} taskData
 */
export function renderFileTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    const fileUrl = taskData?.file_url || "";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0"><i class="bi bi-file-earmark-arrow-up me-1"></i> Файл</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="mb-3 position-relative">
            <label class="form-label d-flex align-items-center">
                Ссылка на файл
                <i class="bi bi-question-circle ms-2 text-primary file-help-btn"
                   style="cursor: pointer;"
                   title="Как получить ссылку?"></i>
            </label>
            <input type="text" class="form-control file-url-input"
                   placeholder="Вставьте ссылку на Google Диск, Яндекс.Диск или Облако Mail"
                   value="${fileUrl}"
                   autocomplete="off">
        </div>

        <div class="mb-3">
            <small class="text-muted">
                Поддерживаются публичные ссылки на файлы с:
                <span class="badge bg-light text-dark me-1">Google Диск</span>
                <span class="badge bg-light text-dark me-1">Яндекс.Диск</span>
                <span class="badge bg-light text-dark me-1">Облако Mail</span>
            </small>
        </div>

        <button class="btn btn-success w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    card.querySelector(".file-help-btn")
        .addEventListener("click", showFileInstructions);

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => card.remove());

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}

/**
 * Показывает подсказку по получению ссылки на файл
 */
function showFileInstructions() {
    const instructions = `
        <div class="file-instructions">
            <h6 class="fw-semibold mb-3">Как получить ссылку на файл?</h6>
            <p class="mb-3">Вставьте публичную ссылку на файл с одного из следующих сервисов:</p>

            <div class="mb-3">
                <strong class="d-block mb-2">Google Диск</strong>
                <ul class="small mb-0">
                    <li>Откройте файл → кнопка «Поделиться» → «Получить ссылку» → включите доступ «Для всех, у кого есть ссылка»</li>
                </ul>
            </div>

            <div class="mb-3">
                <strong class="d-block mb-2">Яндекс.Диск</strong>
                <ul class="small mb-0">
                    <li>Выберите файл → «Поделиться» → «Создать публичную ссылку» → скопируйте ссылку</li>
                </ul>
            </div>

            <div class="mb-3">
                <strong class="d-block mb-2">Облако Mail.ru</strong>
                <ul class="small mb-0">
                    <li>Выберите файл → «Поделиться» → «Ссылка для всех» → скопируйте ссылку</li>
                </ul>
            </div>

            <div class="alert alert-info small mt-3 mb-0">
                Ссылка должна быть публичной, чтобы можно было встроить файл в урок.
            </div>
        </div>
    `;

    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Помощь по ссылке на файл</h5>
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
