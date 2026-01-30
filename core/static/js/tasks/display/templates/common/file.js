import { showLoaderWithPhrases } from "/static/js/tasks/utils.js";

export function renderFileTask(task, container) {
    if (!container) return;
    container.innerHTML = "";

    try {
        const card = document.createElement("div");
        card.className = "rounded-4 mb-3";

        const cardBody = document.createElement("div");
        card.appendChild(cardBody);

        if (task.data.file_link) {
            const button = document.createElement("button");
            button.className = "btn btn-primary btn-lg w-100 mb-3 d-flex justify-content-between align-items-center";
            button.innerHTML = '<span>Открыть файл</span><i class="bi bi-arrow-right-circle-fill fs-4"></i>';

            button.onclick = () => loadFile(cardBody, task.data.file_link, button);

            cardBody.appendChild(button);

            const fileDiv = document.createElement("div");
            fileDiv.className = "file-content position-relative d-none";
            fileDiv.style.minHeight = "700px";
            fileDiv.style.overflow = "hidden";
            cardBody.appendChild(fileDiv);
        } else {
            cardBody.innerHTML = `
                <div class="alert alert-warning text-center mb-0">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    Ссылка на файл не указана
                </div>
            `;
        }

        container.appendChild(card);
    } catch (err) {
        console.error("renderFileTask error:", err);
        container.innerHTML = '<span class="text-danger">Не удалось отобразить задание.</span>';
    }
}

function loadFile(container, fileLink, button) {
    button.classList.add("d-none");

    let fileDiv = container.querySelector(".file-content");
    if (!fileDiv) {
        fileDiv = document.createElement("div");
        fileDiv.className = "file-content position-relative";
        fileDiv.style.minHeight = "700px";
        fileDiv.style.overflow = "hidden";
        container.appendChild(fileDiv);
    }

    fileDiv.classList.remove("d-none");
    fileDiv.innerHTML = "";

    const iframe = document.createElement("iframe");
    iframe.src = fileLink;
    iframe.style.width = "100%";
    iframe.style.height = "700px";
    iframe.style.maxHeight = "90vh";
    iframe.style.border = "none";
    iframe.style.opacity = "0";
    iframe.style.transition = "opacity 0.5s ease";
    iframe.style.display = "block";
    iframe.style.borderRadius = "8px";
    iframe.style.overflow = "hidden";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-forms");

    const phrases = [
        "Файл пакетуется и готовится к показу...",
        "Подготавливаем магическую панель документа...",
        "Загружаем умные пиксели в правильном порядке...",
        "Документ выходит из спячки и зевает...",
        "Просим файл выглядеть презентабельно...",
        "Пылесосим виртуальную пыль со страниц...",
        "Файл делает разминку перед показом...",
        "Подпитываем документ цифровым кофе...",
        "Расставляем буквы по алфавитным квартирам...",
        "Завязываем шнурки на виртуальных кроссовках файла...",
        "Учим файл хорошим манерам для показа...",
        "Разминаем скролл перед долгой работой...",
        "Настраиваем волшебный увеличитель контента...",
        "Файл выбирает лучший наряд для показа...",
        "Разогреваем процессор для идеального рендера...",
        "Приглашаем все символы на свои места...",
        "Натягиваем виртуальный холст для контента...",
        "Проводим файлу утреннюю зарядку...",
        "Расстилаем цифровой ковёр для вашего взгляда...",
        "Файл заваривает чай для комфортного просмотра..."
    ];

    const loader = showLoaderWithPhrases(fileDiv, phrases);
    loader.start();

    const loadTimeout = setTimeout(() => {
        if (iframe.contentWindow && iframe.contentWindow.length === 0) {
            loader.stop();
            loader.showError("Файл замечтался и забыл загрузиться. Давайте попробуем ещё раз!", () => {
                button.classList.remove("d-none");
                fileDiv.classList.add("d-none");
                fileDiv.innerHTML = "";
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
        loader.showError("Файл стесняется и не хочет показываться. Проверьте, не обидели ли вы его?", () => {
            button.classList.remove("d-none");
            fileDiv.classList.add("d-none");
            fileDiv.innerHTML = "";
        });
    };

    fileDiv.appendChild(iframe);
}