/**
 * Рендерит задание с файлом через ссылку
 * @param {Object} task - Объект задания
 * @param {Object} task.data - Данные задания
 * @param {string} [task.data.file_url] - Публичная ссылка на файл (Google Диск, Яндекс.Диск, Mail.ru)
 * @param {string} [task.data.title] - Заголовок задания
 * @param {HTMLElement} container - Контейнер для рендеринга
 */
export function renderFileTask(task, container) {
    if (!container) return;
    container.innerHTML = "";

    try {
        const card = document.createElement("div");
        card.className = "rounded-4 mb-3";

        const cardBody = document.createElement("div");
        card.appendChild(cardBody);

        if (task.data.title) {
            const title = document.createElement("h6");
            title.className = "mb-3 fw-semibold text-primary";
            title.textContent = task.data.title;
            cardBody.appendChild(title);
        }

        const fileDiv = document.createElement("div");
        fileDiv.className = "file-content";

        if (task.data.file_url) {
            // Создаем iframe для файла
            const iframe = document.createElement("iframe");
            iframe.src = task.data.file_url;
            iframe.style.width = "100%";
            iframe.style.maxWidth = "100%";
            iframe.style.border = "none";
            iframe.style.borderRadius = "8px";
            iframe.style.minHeight = "400px";

            fileDiv.appendChild(iframe);
        } else {
            fileDiv.innerHTML = `
                <div class="alert alert-warning text-center mb-0">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Ссылка на файл не указана
                </div>
            `;
        }

        cardBody.appendChild(fileDiv);
        container.appendChild(card);
    } catch (err) {
        console.error("renderFileTask error:", err);
        container.innerHTML = "<span class='text-danger'>Не удалось отобразить задание.</span>";
    }
}
