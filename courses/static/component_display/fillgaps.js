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

    let gapIndex = 0;

    const cleanText = task.data.text
        .replace(/<(\/?)(?!b|i|u|em|strong|ul|ol|li|p|br)(\w+)[^>]*>/gi, '')
        .replace(/\n/g, '<br>');

    const parts = cleanText.split(/(\[[^\]]+\])/g);

    parts.forEach(part => {
        if (part.startsWith('[') && part.endsWith(']')) {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "form-control d-inline-block gap-input mx-1 mb-1 text-start";
            input.style.width = "110px";
            input.setAttribute("data-gap-index", gapIndex);
            gapIndex++;
            textDiv.appendChild(input);
        } else if (part.trim() !== '') {
            const span = document.createElement("span");
            span.innerHTML = part;
            textDiv.appendChild(span);
        }
    });

    cardBody.appendChild(textDiv);
    card.appendChild(cardBody);
    container.appendChild(card);
}