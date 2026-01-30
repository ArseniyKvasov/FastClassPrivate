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
 * Показывает минималистичную подсказку по получению embed-кода
 */
function showEmbedInstructions() {
    const existingModal = document.getElementById('embedHelpModal');
    if (existingModal) {
        const modalInstance = bootstrap.Modal.getInstance(existingModal) || new bootstrap.Modal(existingModal);
        modalInstance.show();
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'embedHelpModal';
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-lg">
            <div class="modal-content rounded-4 shadow-sm">
                <div class="modal-header border-0 pb-0">
                    <h6 class="modal-title fw-semibold">Где взять embed-код?</h6>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Закрыть"></button>
                </div>
                <div class="modal-body pt-2">
                    <p class="small mb-2">Вставьте embed-код (iframe) с одного из поддерживаемых ресурсов:</p>
                    <ul class="small mb-2">
                        <li><strong>YouTube:</strong> Поделиться → Встроить</li>
                        <li><strong>Rutube:</strong> Поделиться → Код вставки плеера</li>
                        <li><strong>Wordwall:</strong> Поделиться → Встраивание</li>
                        <li><strong>Quizlet:</strong> Поделиться → Встроить</li>
                        <li><strong>LearningApps:</strong> Встроить снизу приложения</li>
                        <li><strong>Miro / Sboard:</strong> Поделиться → Embed / Iframe</li>
                    </ul>
                    <div class="alert alert-info small mb-0">
                        Код должен начинаться с <code>&lt;iframe ...&gt;</code> и вести на поддерживаемый ресурс.
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