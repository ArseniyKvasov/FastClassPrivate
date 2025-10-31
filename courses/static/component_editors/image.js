function renderImageTaskEditor(nextTaskId = null) {
    const taskList = document.getElementById("task-list");
    if (!taskList) return;

    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border rounded";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Изображение</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="image-upload-wrapper text-center p-3 border border-dashed rounded position-relative" style="transition: 0.2s;">
            <input type="file" accept="image/*" class="form-control image-input mb-2" style="display: none;">
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

        <button class="btn btn-success mt-3 w-100 fw-semibold">
            Сохранить
        </button>
    `;

    const input = card.querySelector(".image-input");
    const placeholder = card.querySelector(".upload-placeholder");
    const preview = card.querySelector(".preview-img");
    const removeBtn = card.querySelector(".remove-image-btn");
    const wrapper = card.querySelector(".image-upload-wrapper");
    const dragOverlay = card.querySelector(".drag-overlay");

    // === функция для отображения выбранного файла ===
    function handleFile(file) {
        const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];
        if (!file || !allowedTypes.includes(file.type)) {
            showNotification("❌ Пожалуйста, выберите изображение в формате .png, .jpg, .jpeg, .gif, .webp");
            return;
        }

        input.files = new DataTransfer().files; // сброс, если нужно
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            preview.src = base64;
            preview.dataset.base64 = base64;
            preview.classList.remove("d-none");
            removeBtn.classList.remove("d-none");
            placeholder.classList.add("d-none");
        };
        reader.readAsDataURL(file);
    }

    // клик по зоне загрузки
    wrapper.addEventListener("click", (e) => {
        if (e.target === input || e.target === removeBtn) return;
        input.click();
    });

    // выбор файла через input
    input.addEventListener("change", () => {
        if (input.files.length) handleFile(input.files[0]);
    });

    // drag & drop
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

    // удалить изображение
    removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        input.value = "";
        preview.src = "";
        preview.classList.add("d-none");
        removeBtn.classList.add("d-none");
        placeholder.classList.remove("d-none");
        delete preview.dataset.base64;
    });

    // удалить карточку задания
    card.querySelector(".remove-task-btn").addEventListener("click", () => card.remove());

    // кнопка "Сохранить"
    card.querySelector(".btn-success").addEventListener("click", () => saveTask("image", card));

    // вставка карточки в список
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
