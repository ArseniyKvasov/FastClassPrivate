/**
 * Рендерит задание "Заполни пропуски"
 * @param {Object} task
 * @param {HTMLElement} container
 */
export function renderFillGapsTask(task, container) {
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

    if (task.data.list_type === "open" && Array.isArray(task.data.answers) && task.data.answers.length) {
        const hintBlock = document.createElement("div");
        hintBlock.className = "mb-3";

        const list = document.createElement("div");
        list.className = "d-flex flex-wrap gap-2";

        task.data.answers.forEach(answer => {
            const badge = document.createElement("span");
            badge.className = "badge bg-primary me-1 mb-1";
            badge.textContent = answer;

            list.appendChild(badge);
        });

        hintBlock.appendChild(list);
        cardBody.appendChild(hintBlock);
    }

    const textDiv = document.createElement("div");
    textDiv.className = "fill-gaps-text";

    const updateInputWidth = (input) => {
        const value = input.value.trim();
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'pre';
        tempSpan.style.font = window.getComputedStyle(input).font;
        tempSpan.textContent = value || 'П';

        document.body.appendChild(tempSpan);
        const width = Math.max(90, Math.min(tempSpan.offsetWidth + 20, 250));
        document.body.removeChild(tempSpan);

        input.style.width = `${width}px`;
    };

    const createInput = (index) => {
        const input = document.createElement("input");
        input.type = "text";
        input.id = `gap-${index}`;
        input.className = "form-control d-inline gap-input mx-1";
        input.style.minWidth = "90px";
        input.style.maxWidth = "250px";
        input.style.height = "34px";
        input.style.padding = "0 8px";

        input.addEventListener('input', () => {
            updateInputWidth(input);
        });

        updateInputWidth(input);
        return input;
    };

    const htmlText = task.data.text || "";
    const textNodes = [];
    let lastIndex = 0;
    let inputIndex = 0;
    const regex = /\[([^\]]+)\]/g;
    let match;

    while ((match = regex.exec(htmlText)) !== null) {
        if (match.index > lastIndex) {
            const textNode = document.createTextNode(htmlText.substring(lastIndex, match.index));
            textNodes.push(textNode);
        }

        textNodes.push(createInput(inputIndex++));
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < htmlText.length) {
        const textNode = document.createTextNode(htmlText.substring(lastIndex));
        textNodes.push(textNode);
    }

    textNodes.forEach(node => textDiv.appendChild(node));
    cardBody.appendChild(textDiv);

    card.appendChild(cardBody);
    container.appendChild(card);
}