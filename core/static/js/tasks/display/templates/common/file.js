/**
 * Рендерит задание с файлом в контейнер
 * @param {Object} task - Объект задания
 * @param {HTMLElement} container - Контейнер для рендеринга
 */
export function renderFileTask(task, container) {
    if (!container) return;
    container.innerHTML = "";

    try {
        const card = document.createElement("div");
        card.className = "task-card";

        if (task.data.file_path) {
            const fileExtension = task.data.file_path.split('.').pop().toLowerCase();

            if (['pdf'].includes(fileExtension)) {
                renderPdfViewer(card, task.data.file_path);
            } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileExtension)) {
                renderImageViewer(card, task.data.file_path);
            } else if (['mp4', 'webm', 'ogg'].includes(fileExtension)) {
                renderVideoPlayer(card, task.data.file_path);
            } else if (['mp3', 'wav', 'ogg'].includes(fileExtension)) {
                renderAudioPlayer(card, task.data.file_path);
            } else {
                renderDownloadLink(card, task.data.file_path);
            }
        } else {
            card.innerHTML = `
                <div class="alert alert-warning text-center mb-0">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Файл не найден
                </div>
            `;
        }

        container.appendChild(card);
    } catch (err) {
        console.error("renderFileTask error:", err);
        container.innerHTML = '<span class="text-danger">Не удалось отобразить задание.</span>';
    }
}

/**
 * Рендерит PDF через готовый PDF.js viewer (iframe)
 * с заголовком "PDF-файл" над отображением
 *
 * @param {HTMLElement} container
 * @param {string} filePath
 */
function renderPdfViewer(container, filePath) {
    container.innerHTML = "";

    const openButton = document.createElement("button");
    openButton.className = "btn btn-primary btn-lg w-100 d-flex justify-content-between align-items-center rounded mb-3";
    openButton.innerHTML = '<span>Открыть файл</span><i class="bi bi-arrow-right-circle-fill fs-4"></i>';

    const viewerWrapper = document.createElement("div");
    viewerWrapper.className = "border rounded shadow-sm bg-white";
    viewerWrapper.style.display = "none";
    viewerWrapper.style.borderRadius = "12px";
    viewerWrapper.style.overflow = "hidden";

    const title = document.createElement("div");
    title.textContent = "PDF-файл";
    title.className = "fw-semibold small px-3 py-2 border-bottom bg-light";

    const iframe = document.createElement("iframe");
    iframe.style.width = "100%";
    iframe.style.height = "90vh";
    iframe.style.border = "none";

    const viewerUrl =
        `/static/pdfjs/web/viewer.html?file=${encodeURIComponent(filePath)}`;

    iframe.src = viewerUrl;

    viewerWrapper.append(title, iframe);
    container.append(openButton, viewerWrapper);

    openButton.addEventListener("click", () => {
        openButton.remove();
        viewerWrapper.style.display = "block";
    });
}

/**
 * Рендерит изображение
 * @param {HTMLElement} container - Контейнер для изображения
 * @param {string} filePath - Путь к файлу изображения
 */
function renderImageViewer(container, filePath) {
    const img = document.createElement("img");
    img.src = filePath;
    img.className = "img-fluid rounded w-100";
    img.alt = "Изображение";
    img.style.maxHeight = "80vh";
    img.style.objectFit = "contain";

    container.appendChild(img);
}

/**
 * Рендерит видео плеер
 * @param {HTMLElement} container - Контейнер для видео
 * @param {string} filePath - Путь к видео файлу
 */
function renderVideoPlayer(container, filePath) {
    const button = document.createElement("button");
    button.className = "btn btn-primary btn-lg w-100 mb-3 d-flex justify-content-between align-items-center";
    button.innerHTML = '<span>Открыть видео</span><i class="bi bi-arrow-right-circle-fill fs-4"></i>';

    button.onclick = () => {
        button.remove();

        const video = document.createElement("video");
        video.src = filePath;
        video.controls = true;
        video.className = "w-100 rounded";
        video.style.maxHeight = "80vh";

        container.appendChild(video);
    };

    container.appendChild(button);
}

/**
 * Рендерит аудио плеер
 * @param {HTMLElement} container - Контейнер для аудио
 * @param {string} filePath - Путь к аудио файлу
 */
function renderAudioPlayer(container, filePath) {
    const button = document.createElement("button");
    button.className = "btn btn-primary btn-lg w-100 mb-3 d-flex justify-content-between align-items-center";
    button.innerHTML = '<span>Открыть аудио</span><i class="bi bi-arrow-right-circle-fill fs-4"></i>';

    button.onclick = () => {
        button.remove();

        const audioWrapper = document.createElement("div");
        audioWrapper.className = "bg-white border rounded p-4";

        const audio = document.createElement("audio");
        audio.src = filePath;
        audio.controls = true;
        audio.className = "w-100";
        audio.style.height = "50px";

        audioWrapper.appendChild(audio);
        container.appendChild(audioWrapper);
    };

    container.appendChild(button);
}

/**
 * Рендерит ссылку для скачивания файла
 * @param {HTMLElement} container - Контейнер для ссылки
 * @param {string} filePath - Путь к файлу
 */
function renderDownloadLink(container, filePath) {
    const button = document.createElement("button");
    button.className = "btn btn-primary btn-lg w-100 mb-3 d-flex justify-content-between align-items-center";
    button.innerHTML = '<span>Скачать файл</span><i class="bi bi-download fs-4"></i>';

    button.onclick = () => {
        const link = document.createElement("a");
        link.href = filePath;
        link.download = "";
        link.click();
    };

    container.appendChild(button);
}