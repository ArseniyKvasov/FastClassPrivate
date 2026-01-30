import { showNotification } from "/static/js/tasks/utils.js";

/**
 * Рендерит редактор задания типа «Файл».
 *
 * @param {{file_link?: string}|null} taskData
 */
export function renderFileTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    const fileLink = taskData?.file_link || "";

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
            <input type="text" class="form-control file-link-input"
                   placeholder="Вставьте ссылку на файл"
                   value="${fileLink}"
                   autocomplete="off">
        </div>

        <div class="mb-3">
            <small class="text-muted align-items-center">
                Поддерживаются файлы Google Диск
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
    const existingModal = document.getElementById('fileHelpModal');
    if (existingModal) {
        const modalInstance = bootstrap.Modal.getInstance(existingModal) || new bootstrap.Modal(existingModal);
        modalInstance.show();
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'fileHelpModal';
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg">
            <div class="modal-content rounded-4 shadow-sm">
                <div class="modal-header border-0 pb-0">
                    <h6 class="modal-title fw-semibold">Как получить ссылку на файл?</h6>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Закрыть"></button>
                </div>
                <div class="modal-body pt-2">
                    <div class="mb-3">
                        <strong class="d-block mb-2">Google Диск</strong>
                        <ul class="small mb-0">
                            <li>Откройте файл → кнопка «Поделиться» → «Открыть доступ» → «Копировать ссылку»</li>
                            <li>Включите доступ «Для всех, у кого есть ссылка»</li>
                            <li>Скопируйте полученную ссылку</li>
                        </ul>
                    </div>

                    <div class="alert alert-info small mb-0">
                        Ссылка должна быть публичной, чтобы можно было встроить файл в урок.
                    </div>
                </div>
                <div class="modal-footer border-0 pt-2">
                    <button type="button" class="btn btn-sm btn-primary" data-bs-dismiss="modal">Понятно</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    modalInstance.show();

    modal.addEventListener('hidden.bs.modal', () => modal.remove());
}