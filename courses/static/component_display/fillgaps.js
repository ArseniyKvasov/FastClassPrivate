/**
 * Рендерит задание "Заполни пропуски"
 * @param {Object} task - Объект задания
 * @param {Object} task.data - Данные задания
 * @param {string} task.data.text - HTML текст с пропусками в формате [...]
 * @param {string} [task.data.title] - Заголовок задания
 * @param {string} task.data.task_type - Тип задания
 * @param {string[]} [task.data.answers] - Подсказки для задания типа "open"
 * @param {HTMLElement} container - Контейнер для рендеринга
 */
function renderFillGapsTask(task, container) {
    if (!container) return;
    container.innerHTML = "";

    const card = document.createElement("div");
    card.className = "rounded-4 mb-3";

    const cardBody = document.createElement("div");

    if (task.data.title) {
        const title = document.createElement("h6");
        title.className = "mb-3 fw-semibold text-primary";
        title.textContent = task.data.title;
        cardBody.appendChild(title);
    }

    if (task.data.task_type === "open" && Array.isArray(task.data.answers) && task.data.answers.length) {
        const hintBlock = document.createElement("div");
        hintBlock.className = "mb-2";

        const list = document.createElement("ul");
        list.className = "list-inline m-0 p-0";

        task.data.answers.forEach(answer => {
            const li = document.createElement("li");
            li.className = "list-inline-item badge bg-primary rounded-pill px-3 py-2 m-1";
            li.textContent = answer;
            list.appendChild(li);
        });

        hintBlock.appendChild(list);
        cardBody.appendChild(hintBlock);
    }

    const textDiv = document.createElement("div");
    textDiv.className = "fill-gaps-text";

    const htmlText = task.data.text || "";
    const processedHtml = htmlText.replace(/\[([^\]]+)\]/g, '<input type="text" class="form-control d-inline gap-input m-1" style="width: 110px;">');

    textDiv.innerHTML = processedHtml;

    cardBody.appendChild(textDiv);
    card.appendChild(cardBody);
    container.appendChild(card);
}