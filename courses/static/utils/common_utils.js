function getCsrfToken() {
    const name = "csrftoken=";
    const decoded = decodeURIComponent(document.cookie);
    const cookies = decoded.split(";");

    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(name)) {
            return cookie.substring(name.length);
        }
    }
    return "";
}

function confirmAction(text) {
    return new Promise((resolve) => {
        // Создаём затемнение
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.backgroundColor = "rgba(0,0,0,0.5)";
        overlay.style.display = "flex";
        overlay.style.justifyContent = "center";
        overlay.style.alignItems = "center";
        overlay.style.zIndex = "1050";

        // Создаём модальное окно
        const modal = document.createElement("div");
        modal.className = "bg-white rounded-3 p-4 shadow";
        modal.style.minWidth = "300px";
        modal.style.maxWidth = "90%";
        modal.style.textAlign = "center";

        const msg = document.createElement("p");
        msg.textContent = text;
        msg.className = "mb-3";

        const btnConfirm = document.createElement("button");
        btnConfirm.className = "btn btn-danger me-2";
        btnConfirm.textContent = "Удалить";

        const btnCancel = document.createElement("button");
        btnCancel.className = "btn btn-secondary";
        btnCancel.textContent = "Отмена";

        btnConfirm.onclick = () => {
            document.body.removeChild(overlay);
            resolve(true);
        };
        btnCancel.onclick = () => {
            document.body.removeChild(overlay);
            resolve(false);
        };

        modal.appendChild(msg);
        modal.appendChild(btnConfirm);
        modal.appendChild(btnCancel);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    });
}

function showNotification(text) {
    const container = document.getElementById("notification-container");
    if (!container) return;

    // Удаляем старые уведомления, если их больше или равно 2
    const existingToasts = container.querySelectorAll(".toast");
    if (existingToasts.length >= 2) {
        existingToasts[0].remove();
    }

    const toastId = "toast-" + Math.random().toString(36).substr(2, 9);

    const toast = document.createElement("div");
    toast.className = `toast align-items-center text-bg-warning border-0 show my-2`;
    toast.id = toastId;
    toast.role = "alert";
    toast.ariaLive = "assertive";
    toast.ariaAtomic = "true";
    toast.style.minWidth = "200px";
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${text}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove("show");
        toast.addEventListener("transitionend", () => toast.remove());
    }, 3000);
}