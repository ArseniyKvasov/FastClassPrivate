import { showNotification } from "/static/js/tasks/utils.js";

/**
 * Рендерит редактор задания типа «Изображение».
 *
 * @param {Object|null} taskData
 * @param {string} [taskData.file_path]
 * @param {string} [taskData.caption]
 */
export function renderImageTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    const imageUrl = taskData?.file_path || "";
    const captionText = taskData?.caption || "";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0"><i class="bi bi-image me-1"></i> Изображение</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="image-upload-wrapper text-center p-3 border border-dashed rounded position-relative" style="transition: 0.2s;">
            <input type="file" accept="image/*" class="form-control image-input mb-2" style="display: none;" autofocus>
            <div class="upload-placeholder text-secondary">
                <i class="bi bi-image fs-2 d-block mb-2"></i>
                <span>Нажмите или перетащите изображение сюда</span>
            </div>
            <img class="preview-img img-fluid rounded d-none mt-2" alt="Предпросмотр">
            <div class="mt-2">
                <button class="btn btn-sm btn-outline-danger remove-image-btn d-none">
                    <i class="bi bi-trash me-1"></i>Удалить изображение
                </button>
            </div>
            <div class="drag-overlay position-absolute top-0 start-0 w-100 h-100 bg-primary bg-opacity-10 border border-primary border-dashed rounded d-none" style="pointer-events: none;"></div>
        </div>

        <div class="mt-3">
            <input type="text" class="form-control caption-input" placeholder="Введите подпись..." value="${captionText}" maxlength="120">
        </div>

        <button class="btn btn-success mt-3 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const input = card.querySelector(".image-input");
    const placeholder = card.querySelector(".upload-placeholder");
    const preview = card.querySelector(".preview-img");
    const removeBtn = card.querySelector(".remove-image-btn");
    const wrapper = card.querySelector(".image-upload-wrapper");
    const dragOverlay = card.querySelector(".drag-overlay");
    const captionInput = card.querySelector(".caption-input");

    if (imageUrl) {
        preview.src = imageUrl;
        preview.classList.remove("d-none");
        removeBtn.classList.remove("d-none");
        placeholder.classList.add("d-none");
    }

    function handleFile(file) {
        const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
        if (!file || !allowedTypes.includes(file.type)) {
            showNotification("Пожалуйста, выберите изображение в формате .png, .jpg, .jpeg, .gif, .webp");
            return;
        }
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;

        const reader = new FileReader();
        reader.onload = (e) => {
            preview.src = e.target.result;
            preview.classList.remove("d-none");
            removeBtn.classList.remove("d-none");
            placeholder.classList.add("d-none");
        };
        reader.readAsDataURL(file);
    }

    wrapper.addEventListener("click", (e) => {
        if (e.target === input || e.target === removeBtn) return;
        input.click();
    });

    input.addEventListener("change", () => {
        if (input.files.length) handleFile(input.files[0]);
    });

    wrapper.addEventListener("dragenter", (e) => { e.preventDefault(); e.stopPropagation(); dragOverlay.classList.remove("d-none"); wrapper.classList.add("border-primary"); });
    wrapper.addEventListener("dragover", (e) => { e.preventDefault(); e.stopPropagation(); dragOverlay.classList.remove("d-none"); });
    wrapper.addEventListener("dragleave", (e) => { if (e.target === wrapper || e.relatedTarget === null) { dragOverlay.classList.add("d-none"); wrapper.classList.remove("border-primary"); } });
    wrapper.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragOverlay.classList.add("d-none");
        wrapper.classList.remove("border-primary");
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        input.value = "";
        preview.src = "";
        preview.classList.add("d-none");
        removeBtn.classList.add("d-none");
        placeholder.classList.remove("d-none");
    });

    card.querySelector(".remove-task-btn").addEventListener("click", () => card.remove());

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}
