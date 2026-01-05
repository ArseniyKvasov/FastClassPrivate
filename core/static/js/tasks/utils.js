/**
 * Получает CSRF-токен из cookie
 * @returns {string} csrftoken
 */
export function getCsrfToken() {
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

/**
 * Показывает уведомление в правом нижнем углу экрана
 * @param {string} text - Текст уведомления
 */
export function showNotification(text) {
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

/**
 * Мини-функция для "debounce"
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Простейший fetch POST с CSRF
 * @param {string} url
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function postJSON(url, data) {
    const csrfToken = getCsrfToken();
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify(data),
    });
    return res.json();
}

/**
 * Показывает минималистичное окно подтверждения.
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export function confirmAction(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        Object.assign(overlay.style, {
            position: "fixed",
            inset: "0",
            backgroundColor: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: "1050",
        });

        const modal = document.createElement("div");
        modal.className = "bg-white rounded-3 shadow";
        Object.assign(modal.style, {
            padding: "20px 24px",
            minWidth: "280px",
            maxWidth: "90%",
            textAlign: "center",
        });

        const msg = document.createElement("div");
        msg.textContent = message;
        Object.assign(msg.style, {
            marginBottom: "16px",
            fontSize: "15px",
            color: "#212529",
        });

        const actions = document.createElement("div");
        Object.assign(actions.style, {
            display: "flex",
            justifyContent: "center",
            gap: "20px",
        });

        const btnConfirm = document.createElement("button");
        btnConfirm.type = "button";
        btnConfirm.textContent = "Да";
        Object.assign(btnConfirm.style, {
            background: "none",
            border: "none",
            padding: "4px 8px",
            color: "#0d6efd",
            fontWeight: "600",
            cursor: "pointer",
        });

        const btnCancel = document.createElement("button");
        btnCancel.type = "button";
        btnCancel.textContent = "Нет";
        Object.assign(btnCancel.style, {
            background: "none",
            border: "none",
            padding: "4px 8px",
            color: "#6c757d",
            fontWeight: "600",
            cursor: "pointer",
        });

        btnConfirm.addEventListener("click", () => {
            document.body.removeChild(overlay);
            resolve(true);
        });

        btnCancel.addEventListener("click", () => {
            document.body.removeChild(overlay);
            resolve(false);
        });

        actions.append(btnConfirm, btnCancel);
        modal.append(msg, actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    });
}

/**
 * Маппинг типов заданий -> модули и имена экспортов.
 * Содержит иконку + читабельную русскую метку для селектора.
 *
 * key = task_type
 * value = {
 *   render: [relative_path_to_file, exported_render_function],
 *   edit:   [relative_path_to_file, exported_edit_function],
 *   icon:   "bi-...",
 *   label:  "Русское название"
 * }
 */
export const TASK_MAP = {
    fill_gaps: {
        render: ["./templates/common/fillGaps.js", "renderFillGapsTask"],
        edit:   ["./templates/common/fillGaps.js", "renderFillGapsTaskEditor"],
        icon:   "bi-pen",
        label:  "Заполнить пропуски"
    },
    image: {
        render: ["./templates/common/image.js", "renderImageTask"],
        edit:   ["./templates/common/image.js", "renderImageTaskEditor"],
        icon:   "bi-image",
        label:  "Картинка"
    },
    note: {
        render: ["./templates/common/note.js", "renderNoteTask"],
        edit:   ["./templates/common/note.js", "renderNoteTaskEditor"],
        icon:   "bi-stickies",
        label:  "Заметка"
    },
    text_input: {
        render: ["./templates/common/textInput.js", "renderTextInputTask"],
        edit:   ["./templates/common/textInput.js", "renderTextInputTaskEditor"],
        icon:   "bi-text-paragraph",
        label:  "Текстовое задание"
    },
    true_false: {
        render: ["./templates/common/trueFalse.js", "renderTrueFalseTask"],
        edit:   ["./templates/common/trueFalse.js", "renderTrueFalseTaskEditor"],
        icon:   "bi-check2-circle",
        label:  "Правда или ложь"
    },
    match_cards: {
        render: ["./templates/common/matchCards.js", "renderMatchCardsTask"],
        edit:   ["./templates/common/matchCards.js", "renderMatchCardsTaskEditor"],
        icon:   "bi-arrow-left-right",
        label:  "Соотнеси карточки"
    },
    integration: {
        render: ["./templates/common/integration.js", "renderIntegrationTask"],
        edit:   ["./templates/common/integration.js", "renderIntegrationTaskEditor"],
        icon:   "bi-puzzle",
        label:  "Интеграция"
    },
    test: {
        render: ["./templates/common/test.js", "renderTestTask"],
        edit:   ["./templates/common/test.js", "renderTestTaskEditor"],
        icon:   "bi-list-check",
        label:  "Тест"
    }
};

/**
 * Читает sectionId из #info dataset
 * @returns {string|null}
 */
export function readSectionId() {
    const info = document.getElementById("info");
    return info?.dataset?.sectionId || null;
}

/**
 * Загружает отдельное задание по ID
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function fetchSingleTask(id) {
    try {
        const res = await fetch(`/courses/get-task/${id}/`);
        if (!res.ok) throw new Error("Ошибка запроса");
        return await res.json();
    } catch (err) {
        console.error("fetchSingleTask error:", err);
        return null;
    }
}

/**
 * Простая функция экранирования для value/HTML вставок.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str = "") {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}

export function generateId(prefix = "id") {
    return prefix + "-" + Math.random().toString(36).substr(2, 9);
}

export function getInfoElement() {
    return document.getElementById("info");
}

export function getIsTeacher() {
    const infoEl = getInfoElement();
    return infoEl?.dataset?.isTeacher === "true";
}

export function getIsClassroom() {
    const infoEl = getInfoElement();
    return Boolean(infoEl?.dataset?.classroomId);
}

export function getLessonId() {
    const infoEl = getInfoElement();
    return infoEl?.dataset?.lessonId || null;
}

export function getSectionId() {
    const infoEl = getInfoElement();
    return infoEl?.dataset?.sectionId || null;
}
