function renderImageTask(task, container) {
    if (!container) return;
    container.innerHTML = "";

    try {
        const card = document.createElement("div");
        card.className = "rounded-4 mb-3";

        const cardBody = document.createElement("div");
        cardBody.className = "text-center";

        const img = document.createElement("img");
        img.src = task.data.image_url;
        img.alt = "Изображение не доступно - обновите страницу.";
        img.className = "img-fluid rounded-3 mb-2";

        cardBody.appendChild(img);

        if (task.data.caption) {
            const caption = document.createElement("div");
            caption.className = "text-secondary";
            caption.textContent = task.data.caption;
            cardBody.appendChild(caption);
        }

        card.appendChild(cardBody);
        container.appendChild(card);
    } catch {
        container.innerHTML = "<span class='text-danger'>Не удалось отобразить задание.</span>";
    }
}