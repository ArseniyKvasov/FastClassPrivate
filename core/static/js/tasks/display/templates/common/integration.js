/**
 * Рендерит задание с внешней интеграцией через embed-код
 * @param {Object} task - Объект задания
 * @param {Object} task.data - Данные задания
 * @param {string} [task.data.embed_code] - HTML embed-код интеграции
 * @param {string} [task.data.title] - Заголовок задания
 * @param {HTMLElement} container - Контейнер для рендеринга
 */
export function renderIntegrationTask(task, container) {
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

        const integrationDiv = document.createElement("div");
        integrationDiv.className = "integration-content";

        if (task.data.embed_code) {
            integrationDiv.innerHTML = task.data.embed_code;

            const iframe = integrationDiv.querySelector("iframe");
            if (iframe) {
                iframe.style.width = "100%";
                iframe.style.maxWidth = "100%";
                iframe.style.border = "none";
                iframe.style.borderRadius = "8px";
                iframe.style.minHeight = "400px";
            }
        } else {
            integrationDiv.innerHTML = `
                <div class="alert alert-warning text-center mb-0">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Embed-код не загружен
                </div>
            `;
        }

        cardBody.appendChild(integrationDiv);
        container.appendChild(card);
    } catch (err) {
        console.error("renderIntegrationTask error:", err);
        container.innerHTML = "<span class='text-danger'>Не удалось отобразить задание.</span>";
    }
}
