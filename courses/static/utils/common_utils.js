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
    let container = document.getElementById("notification-container");

    if (!container) {
        container = document.createElement("div");
        container.id = "notification-container";
        container.style.position = "fixed";
        container.style.left = "1rem";
        container.style.bottom = "1rem";
        container.style.display = "flex";
        container.style.flexDirection = "column-reverse";
        container.style.gap = "0.5rem";
        container.style.maxHeight = "60vh";
        container.style.overflowY = "auto";
        container.style.zIndex = "1080";
        container.style.width = "auto";
        container.style.maxWidth = "calc(100% - 2rem)";
        document.body.appendChild(container);
    }

    const existingToasts = container.querySelectorAll(".toast");
    if (existingToasts.length >= 3) {
        existingToasts[0].remove();
    }

    const toast = document.createElement("div");
    toast.className = "toast align-items-center text-white border-0 show p-2 rounded shadow-sm";
    toast.style.backgroundColor = "rgba(50, 50, 50, 0.9)";
    toast.style.minWidth = "220px";
    toast.style.width = "auto";
    toast.style.maxWidth = "100%";
    toast.style.wordBreak = "break-word";
    toast.style.fontSize = "0.875rem";
    toast.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
    toast.innerHTML = `
        <div class="d-flex align-items-center justify-content-between">
            <div class="toast-body">${text}</div>
            <button type="button" class="btn-close btn-close-white ms-2 p-1" aria-label="Close"></button>
        </div>
    `;

    toast.querySelector(".btn-close").addEventListener("click", () => toast.remove());

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = "opacity 0.4s, transform 0.4s";
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-20px)";
        toast.addEventListener("transitionend", () => toast.remove());
    }, 3000);
}

function generateId(prefix = "id") {
    return prefix + "-" + Math.random().toString(36).substr(2, 9);
}

function renderSectionItem(section) {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center border-0 px-2 my-1 rounded';
    li.dataset.sectionId = section.id;

    let innerHTML = `
        <div class="d-flex align-items-center gap-2" style="flex:1; min-width:0;">
            ${isAdmin && !isClassroom ? `<span class="drag-handle me-2" aria-hidden="true" title="Перетащить">☰</span>` : ''}
            <button type="button"
                    class="btn btn-link section-link text-decoration-none text-truncate p-0 me-2"
                    data-section-id="${section.id}">
                ${section.title}
            </button>
        </div>
    `;

    if (isAdmin && !isClassroom) {
        innerHTML += `
            <div class="section-action-buttons align-items-center" style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn btn-link p-0 edit-section-button" data-section-id="${section.id}" title="Редактировать">
                    <i class="bi bi-pencil-fill text-secondary"></i>
                </button>
                <button type="button" class="btn btn-link p-0 delete-btn" data-section-id="${section.id}" title="Удалить">
                    <i class="bi bi-trash3-fill text-secondary"></i>
                </button>
            </div>
        `;
    }

    li.innerHTML = innerHTML;
    sectionList.appendChild(li);
}

async function fetchSectionTasks(sectionId) {
    if (typeof sectionId === "undefined" || !sectionId) {
        showNotification("Произошла ошибка. Невозможно загрузить задания.");
        throw new Error("sectionId не определен");
    }

    try {
        const res = await fetch(`/courses/get-tasks/${sectionId}/`);
        const data = await res.json();

        if (!data.success) {
            showNotification(`❌ Ошибка: ${data.errors}`);
            return [];
        }

        return data.tasks;
    } catch (err) {
        console.error(err);
        showNotification("❌ Ошибка сети при загрузке заданий");
        return [];
    }
}

async function fetchSingleTask(taskId) {
    if (!taskId) {
        showNotification("Произошла ошибка. Не указан ID задания.");
        throw new Error("taskId не определен");
    }

    try {
        const res = await fetch(`/courses/get-task/${taskId}/`);
        const data = await res.json();

        if (!data.success) {
            showNotification(`❌ Ошибка: ${data.errors}`);
            return null;
        }

        return data.task;
    } catch (err) {
        console.error(err);
        showNotification("❌ Ошибка сети при загрузке задания");
        return null;
    }
}