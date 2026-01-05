import { showNotification, escapeHtml, getSectionId, getInfoElement } from "@tasks/utils";
import { getViewedUserId } from "@classroom/answers/utils.js";
import { handleSectionAnswers } from "@classroom/answers/handleAnswer.js";
import { clearAllTaskContainers } from "@classroom/answers/handlers/clearAnswers.js";

/**
 * Инициализирует панель управления учениками.
 *
 * @param {Array<{id: number|string, name: string}>} studentsList
 */
export async function initStudentPanel(studentsList = []) {
    const dropdownMenu = document.getElementById("studentDropdownMenu");
    const dropdownButton = document.getElementById("studentDropdown");
    const invitationModalEl = document.getElementById("invitationModal");
    const disableCopyingButton = document.getElementById("disableCopyingButton");
    const refreshPageButton = document.getElementById("refreshPageButton");
    const infoEl = getInfoElement();

    if (!dropdownMenu || !dropdownButton || !infoEl) return;

    dropdownMenu.innerHTML = "";
    appendMenuItem(dropdownMenu, { id: "all", name: "Все ученики" });

    if (Array.isArray(studentsList) && studentsList.length > 0) {
        studentsList.forEach(s => {
            appendMenuItem(dropdownMenu, { id: String(s.id), name: s.name });
        });
        appendDivider(dropdownMenu);
        dropdownMenu.appendChild(createAddStudentButton());
    }

    dropdownMenu.addEventListener("click", (event) => {
        const item = event.target.closest(".dropdown-item");
        if (!item) return;

        if (item.id === "addStudentButton") {
            event.preventDefault();
            if (invitationModalEl && typeof bootstrap !== "undefined") {
                new bootstrap.Modal(invitationModalEl).show();
            }
            return;
        }

        event.preventDefault();
        const studentId = item.dataset.studentId;
        selectStudent(studentId, item, dropdownMenu, dropdownButton, infoEl);
    });

    if (disableCopyingButton) {
        disableCopyingButton.addEventListener("click", toggleCopying);
    }

    if (refreshPageButton) {
        refreshPageButton.addEventListener("click", () => location.reload());
    }

    const initialId = String(getViewedUserId());
    const initialOption =
        dropdownMenu.querySelector(`.student-option[data-student-id="${initialId}"]`) ||
        dropdownMenu.querySelector(`.student-option[data-student-id="all"]`);

    if (initialOption) {
        selectStudent(initialOption.dataset.studentId, initialOption, dropdownMenu, dropdownButton, infoEl, true);
    }
}

export function loadStudentData() {
    try {
        handleSectionAnswers();
    } catch (err) {
        console.error("Ошибка при загрузке данных ученика:", err);
        try {
            showNotification("Не удалось загрузить данные ученика");
        } catch (e) {}
    }
}

function appendMenuItem(menu, { id, name }) {
    const li = document.createElement("li");
    li.innerHTML = `
        <a class="dropdown-item student-option text-black" href="#" data-student-id="${id}">
            ${escapeHtml(String(name))}
        </a>
    `;
    menu.appendChild(li);
}

function appendDivider(menu) {
    const li = document.createElement("li");
    li.innerHTML = '<hr class="dropdown-divider">';
    menu.appendChild(li);
}

function createAddStudentButton() {
    const li = document.createElement("li");
    li.innerHTML = `
        <button class="dropdown-item text-warning" id="addStudentButton" type="button"
                data-bs-toggle="modal" data-bs-target="#invitationModal">
            <i class="bi bi-person-plus me-2" aria-hidden="true"></i>
            Добавить ученика
        </button>
    `;
    return li;
}

async function selectStudent(studentId, itemEl, dropdownMenu, dropdownButton, infoEl, isInitial = false) {
    dropdownMenu.querySelectorAll(".student-option").forEach(i => {
        i.classList.remove("active");
    });

    if (itemEl) itemEl.classList.add("active");

    dropdownButton.textContent = itemEl
        ? itemEl.textContent.trim()
        : studentId === "all"
            ? "Все ученики"
            : String(studentId);

    infoEl.dataset.viewedUserId = String(studentId);

    if (!isInitial) {
        await clearAllTaskContainers();
        if (studentId === "all") {
            safeInvoke(() => handleSectionAnswers(), "Не удалось загрузить статистику по разделу");
        } else {
            safeInvoke(loadStudentData, "Не удалось загрузить данные ученика");
        }
    }
}

function toggleCopying(e) {
    e.preventDefault();

    const btn = e.currentTarget;
    const icon = btn.querySelector("i");
    const textEl = btn.querySelector(".text");
    const allowed = document.body.classList.contains("copy-allowed");

    if (allowed) {
        document.body.classList.remove("copy-allowed");
        document.body.style.userSelect = "none";
        icon?.classList.replace("bi-check-lg", "bi-ban");
        if (textEl) textEl.textContent = "Разрешить копирование";
        btn.classList.replace("text-success", "text-danger");
        showNotification("Копирование запрещено");
    } else {
        document.body.classList.add("copy-allowed");
        document.body.style.userSelect = "text";
        icon?.classList.replace("bi-ban", "bi-check-lg");
        if (textEl) textEl.textContent = "Запретить копирование";
        btn.classList.replace("text-danger", "text-success");
        showNotification("Копирование разрешено");
    }
}

function safeInvoke(fn, message) {
    try {
        fn();
    } catch (err) {
        console.error(message, err);
        try {
            showNotification(message);
        } catch (e) {}
    }
}
