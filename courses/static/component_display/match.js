function renderMatchCardsTask(task, container) {
    if (!container) return;
    container.innerHTML = "";

    if (!Array.isArray(task.data.shuffled_cards) || !task.data.shuffled_cards) {
        console.warn("task.data.shuffled_cards не является массивом:", task.data.shuffled_cards);
        container.innerHTML = "<div class='text-danger'>Некорректные данные карточек.</div>";
        return;
    }

    task.data.shuffled_cards.forEach(card => {
        const row = document.createElement("div");
        row.className = "d-flex gap-2 mb-2";

        const leftBtn = document.createElement("button");
        leftBtn.className = "btn btn-outline-secondary flex-fill col-6 left-card";
        leftBtn.textContent = card.card_left || "";
        leftBtn.dataset.left = card.card_left || "";
        leftBtn.dataset.right = card.card_right || "";

        const rightBtn = document.createElement("button");
        rightBtn.className = "btn btn-outline-secondary flex-fill col-6 right-card";
        rightBtn.textContent = card.card_right || "";
        rightBtn.dataset.left = card.card_left || "";
        rightBtn.dataset.right = card.card_right || "";

        row.appendChild(leftBtn);
        row.appendChild(rightBtn);
        container.appendChild(row);
    });
}