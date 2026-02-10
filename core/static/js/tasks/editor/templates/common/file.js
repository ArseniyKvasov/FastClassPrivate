import { showNotification } from "js/tasks/utils.js";

/**
 * Рендерит редактор задания типа «Файл».
 *
 * @param {Object|null} taskData
 * @param {string} [taskData.file_path]
 * @returns {HTMLElement}
 */
export function renderFileTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    const filePath = taskData?.file_path || "";
    const fileName = filePath ? filePath.split("/").pop() : "";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">
                <i class="bi bi-file-earmark-arrow-up me-1"></i> Файл
            </h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="file-upload-wrapper text-center p-3 border border-dashed rounded position-relative"
             style="transition: 0.2s; cursor: pointer;">
            <input type="file" class="form-control file-input" style="display: none;" autofocus>

            <div class="upload-placeholder text-secondary">
                <i class="bi bi-cloud-arrow-up fs-2 d-block mb-2"></i>
                <span>Нажмите или перетащите файл сюда</span>
                <div class="small mt-1 text-muted">
                    PDF, видео, аудио, изображения (до 50 МБ)
                </div>
            </div>

            <div class="file-preview d-none mt-2">
                <div class="p-2 bg-light border rounded w-100">
                    <div class="d-flex align-items-center" style="overflow: hidden;">
                        <i class="bi bi-file-earmark-text fs-3 text-primary me-3 flex-shrink-0"></i>
                        <div class="text-truncate flex-grow-1" style="min-width: 0;">
                            <div class="fw-medium file-name text-truncate"></div>
                            <div class="small text-muted file-size"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-2">
                <button class="btn btn-sm btn-outline-danger remove-file-btn d-none">
                    <i class="bi bi-trash me-1"></i>Удалить файл
                </button>
            </div>

            <div class="drag-overlay position-absolute top-0 start-0 w-100 h-100
                        bg-primary bg-opacity-10 border border-primary border-dashed
                        rounded d-none"
                 style="pointer-events: none;"></div>
        </div>

        <button class="btn btn-success mt-3 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const input = card.querySelector(".file-input");
    const placeholder = card.querySelector(".upload-placeholder");
    const preview = card.querySelector(".file-preview");
    const fileNameEl = card.querySelector(".file-name");
    const fileSizeEl = card.querySelector(".file-size");
    const removeBtn = card.querySelector(".remove-file-btn");
    const wrapper = card.querySelector(".file-upload-wrapper");
    const dragOverlay = card.querySelector(".drag-overlay");

    if (filePath) {
        fileNameEl.textContent = fileName;
        fileSizeEl.textContent = "Загруженный файл";
        preview.classList.remove("d-none");
        removeBtn.classList.remove("d-none");
        placeholder.classList.add("d-none");
        wrapper.style.cursor = "default";
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} Б`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
    }

    function handleFile(file) {
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            showNotification("Файл слишком большой. Максимальный размер: 50 МБ");
            return;
        }

        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;

        fileNameEl.textContent = file.name;
        fileSizeEl.textContent = formatFileSize(file.size);

        preview.classList.remove("d-none");
        removeBtn.classList.remove("d-none");
        placeholder.classList.add("d-none");

        wrapper.style.cursor = "default";
        wrapper.classList.remove("border-dashed");
    }

    wrapper.addEventListener("click", () => {
        if (preview.classList.contains("d-none")) {
            input.click();
        }
    });

    input.addEventListener("change", () => {
        if (input.files.length) {
            handleFile(input.files[0]);
        }
    });

    wrapper.addEventListener("dragenter", (e) => {
        if (!preview.classList.contains("d-none")) return;
        e.preventDefault();
        dragOverlay.classList.remove("d-none");
        wrapper.classList.add("border-primary");
    });

    wrapper.addEventListener("dragover", (e) => {
        if (!preview.classList.contains("d-none")) return;
        e.preventDefault();
        dragOverlay.classList.remove("d-none");
    });

    wrapper.addEventListener("dragleave", (e) => {
        if (e.target === wrapper || e.relatedTarget === null) {
            dragOverlay.classList.add("d-none");
            wrapper.classList.remove("border-primary");
        }
    });

    wrapper.addEventListener("drop", (e) => {
        if (!preview.classList.contains("d-none")) return;
        e.preventDefault();
        dragOverlay.classList.add("d-none");
        wrapper.classList.remove("border-primary");
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();

        input.value = "";
        preview.classList.add("d-none");
        removeBtn.classList.add("d-none");
        placeholder.classList.remove("d-none");

        wrapper.style.cursor = "pointer";
        wrapper.classList.add("border-dashed");
    });

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => card.remove());

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}
