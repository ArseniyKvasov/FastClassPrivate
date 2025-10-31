export function renderFillGapsTask(task, container) {
    if (!container) return;
    container.innerHTML = "";

    const card = document.createElement("div");
    card.className = "rounded-4 mb-3";

    const cardBody = document.createElement("div");

    if (task.title) {
        const title = document.createElement("h6");
        title.className = "mb-3 fw-semibold text-primary";
        title.textContent = task.title;
        cardBody.appendChild(title);
    }

    if (task.task_type === "open" && Array.isArray(task.answers) && task.answers.length) {
        const hintBlock = document.createElement("div");
        hintBlock.className = "mb-2";

        const list = document.createElement("ul");
        list.className = "list-inline m-0 p-0";

        task.answers.forEach(answer => {
            const li = document.createElement("li");
            li.className = "list-inline-item badge bg-primary rounded-pill px-3 py-2";
            li.textContent = answer;
            list.appendChild(li);
        });

        hintBlock.appendChild(list);
        cardBody.appendChild(hintBlock);
    }

    const textDiv = document.createElement("div");
    textDiv.className = "fill-gaps-text";
    textDiv.innerHTML = task.text.replace(/\[([^\]]+)\]/g, () => {
        return `<input type="text" class="form-control d-inline-block gap-input mx-1 mb-1 text-start" style="width: 110px;">`;
    });
    cardBody.appendChild(textDiv);

    card.appendChild(cardBody);
    container.appendChild(card);
}
