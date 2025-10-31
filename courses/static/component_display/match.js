export function renderMatchCardsTask(task, container) {
    if (!container) return;
    container.innerHTML = "";

    if (!Array.isArray(task.cards)) {
        console.warn("task.cards не является массивом:", task.cards);
        container.innerHTML = "<div class='text-danger'>Некорректные данные карточек.</div>";
        return;
    }

    task.cards.forEach(card => {
        const row = document.createElement("div");
        row.className = "d-flex gap-2 mb-2";

        const leftBtn = document.createElement("button");
        leftBtn.className = "btn btn-outline-primary flex-fill text-truncate"; // изменено на primary
        leftBtn.textContent = card.card_left || "";

        const rightBtn = document.createElement("button");
        rightBtn.className = "btn btn-outline-primary flex-fill text-truncate"; // изменено на primary
        rightBtn.textContent = card.card_right || "";

        row.appendChild(leftBtn);
        row.appendChild(rightBtn);
        container.appendChild(row);
    });
}
