/**
 * Рендерит задание с изображением
 * @param {Object} task - Объект задания
 * @param {Object} task.data - Данные задания
 * @param {string} task.data.file_url - URL изображения
 * @param {string} [task.data.caption] - Подпись к изображению
 * @param {string} [task.data.title] - Заголовок задания
 * @param {HTMLElement} container - Контейнер для рендеринга
 */
export function renderImageTask(task, container) {
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

        const imgWrapper = document.createElement("div");
        imgWrapper.className = "text-center mb-2";

        const img = document.createElement("img");
        img.src = task.data.file_url;
        img.alt = "Изображение задания";
        img.className = "img-fluid rounded-3";

        img.onerror = function() {
            this.style.display = "none";

            const errorMsg = document.createElement("div");
            errorMsg.className = "alert alert-warning p-3 rounded-3";
            errorMsg.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-image text-danger fs-4"></i>
                    <div>
                        <strong>Изображение недоступно</strong>
                    </div>
                </div>
            `;

            imgWrapper.insertBefore(errorMsg, img);
        };

        imgWrapper.appendChild(img);

        if (task.data.caption) {
            const caption = document.createElement("div");
            caption.className = "text-secondary fst-italic mt-1";
            caption.textContent = task.data.caption;
            imgWrapper.appendChild(caption);
        }

        cardBody.appendChild(imgWrapper);
        container.appendChild(card);
    } catch (err) {
        console.error("renderImageTask error:", err);
        container.innerHTML = "<span class='text-danger'>Не удалось отобразить задание.</span>";
    }
}
