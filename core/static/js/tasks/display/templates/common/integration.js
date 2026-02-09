import { showLoaderWithPhrases } from "/static/js/tasks/utils.js";

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

        if (task.data.embed_code) {
            const button = document.createElement("button");
            button.className = "btn btn-primary btn-lg w-100 mb-3 d-flex justify-content-between align-items-center";
            button.innerHTML = '<span>Открыть</span><i class="bi bi-arrow-right-circle-fill fs-4"></i>';

            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = task.data.embed_code;
            const iframe = tempDiv.querySelector("iframe");

            if (iframe) {
                iframe.style.width = "100%";
                iframe.style.height = "100%";
                iframe.style.border = "none";
                iframe.style.borderRadius = "8px";
                iframe.style.display = "block";
                iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-forms");

                button.onclick = () => loadIntegration(cardBody, iframe.outerHTML, button);
            } else {
                button.onclick = () => {
                    button.innerHTML = '<span>Ошибка загрузки</span><i class="bi bi-exclamation-triangle fs-4"></i>';
                    button.classList.replace("btn-primary", "btn-danger");
                    button.disabled = true;
                };
            }

            cardBody.appendChild(button);

            const integrationDiv = document.createElement("div");
            integrationDiv.className = "integration-content position-relative d-none";
            integrationDiv.style.height = "500px";
            integrationDiv.style.maxHeight = "90vh";
            integrationDiv.style.overflow = "hidden";
            integrationDiv.id = `integration-${Date.now()}`;
            cardBody.appendChild(integrationDiv);
        } else {
            cardBody.innerHTML = `
                <div class="alert alert-warning text-center mb-0">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Ссылка не загружена
                </div>
            `;
        }

        container.appendChild(card);
    } catch (err) {
        console.error("renderIntegrationTask error:", err);
        container.innerHTML = '<span class="text-danger">Не удалось отобразить задание.</span>';
    }
}

function loadIntegration(container, embedHtml, button) {
    button.classList.add("d-none");

    let integrationDiv = container.querySelector(".integration-content");
    if (!integrationDiv) {
        integrationDiv = document.createElement("div");
        integrationDiv.className = "integration-content position-relative";
        integrationDiv.style.height = "500px";
        integrationDiv.style.maxHeight = "90vh";
        integrationDiv.style.overflow = "hidden";
        container.appendChild(integrationDiv);
    }

    integrationDiv.classList.remove("d-none");
    integrationDiv.innerHTML = "";

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = embedHtml;

    const iframe = tempDiv.querySelector("iframe");
    if (!iframe) {
        integrationDiv.innerHTML = `
            <div class="alert alert-danger h-100 d-flex align-items-center justify-content-center">
                <i class="bi bi-exclamation-octagon me-2"></i>
                Ошибка загрузки контента
            </div>
        `;
        return;
    }

    iframe.style.width = "100%";
    iframe.style.height = "500px";
    iframe.style.maxHeight = "90vh";
    iframe.style.border = "none";
    iframe.style.borderRadius = "8px";
    iframe.style.opacity = "0";
    iframe.style.transition = "opacity 0.5s ease";
    iframe.style.display = "block";
    iframe.style.overflow = "hidden";

    const phrases = [
        "Интеграция разминает цифровые мускулы...",
        "Соединяем виртуальные провода с волшебством...",
        "Сервис просыпается и потягивается...",
        "Загружаем магию по Wi-Fi...",
        "Интеграция выбирает лучший костюм для показа...",
        "Настраиваем камеру для идеального селфи контента...",
        "Внешний сервис заваривает облачный чай...",
        "Синхронизируем вселенские потоки данных...",
        "Контент делает утреннюю йогу перед показом...",
        "Подключаем невидимые USB-кабели к магии...",
        "Сервис проверяет свой цифровой макияж...",
        "Загружаем смайлики для весёлого контента...",
        "Интеграция репетирует своё выступление...",
        "Настраиваем волшебный переводчик API...",
        "Внешний мир подключается к нашему экрану...",
        "Контент разглаживает виртуальные морщинки...",
        "Запускаем пропеллеры цифрового вертолёта...",
        "Интеграция ищет потерянные биты в облаках...",
        "Надуваем цифровые шарики для праздника...",
        "Сервис завязывает бантик перед показом..."
    ];

    const loader = showLoaderWithPhrases(integrationDiv, phrases);
    loader.start();

    const loadTimeout = setTimeout(() => {
        if (iframe.contentWindow && iframe.contentWindow.length === 0) {
            loader.stop();
            loader.showError("Интеграция улетела в цифровое путешествие. Вернём её обратно?", () => {
                button.classList.remove("d-none");
                integrationDiv.classList.add("d-none");
                integrationDiv.innerHTML = "";
            });
        }
    }, 40000);

    iframe.onload = () => {
        clearTimeout(loadTimeout);
        loader.stop();
        iframe.style.opacity = "1";
    };

    iframe.onerror = () => {
        clearTimeout(loadTimeout);
        loader.stop();
        loader.showError("Интеграция застряла в цифровом лифте. Вызовем сантехника?", () => {
            button.classList.remove("d-none");
            integrationDiv.classList.add("d-none");
            integrationDiv.innerHTML = "";
        });
    };

    integrationDiv.appendChild(iframe);
}