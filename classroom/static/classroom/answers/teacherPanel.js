import { showNotification, escapeHtml, getInfoElement } from "/static/js/tasks/utils.js";
import { getViewedUserId } from "/static/classroom/answers/utils.js";
import { handleSectionAnswers } from "/static/classroom/answers/handleAnswer.js";
import { clearAllTaskContainers } from "/static/classroom/answers/handlers/clearAnswers.js";
import { clearStatistics } from "/static/classroom/answers/handlers/statistics.js";

/**
 * Инициализирует панель управления учениками
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

    appendMenuItem(dropdownMenu, { id: "all", name: "Статистика" });

    if (Array.isArray(studentsList) && studentsList.length > 0) {
        studentsList.forEach(s => {
            appendMenuItem(dropdownMenu, {
                id: String(s.id),
                name: s.name
            });
        });

        appendDivider(dropdownMenu);
        dropdownMenu.appendChild(createAddStudentButton());
    }

    dropdownMenu.addEventListener("click", event => {
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
        selectStudent(
            studentId,
            item,
            dropdownMenu,
            dropdownButton,
            infoEl
        );
    });

    if (disableCopyingButton) {
        disableCopyingButton.addEventListener("click", toggleCopying);
    }

    if (refreshPageButton) {
        refreshPageButton.addEventListener("click", () => location.reload());
    }

    const initialId = String(getViewedUserId());
    const initialOption =
        dropdownMenu.querySelector(
            `.student-option[data-student-id="${initialId}"]`
        ) ||
        dropdownMenu.querySelector(
            `.student-option[data-student-id="all"]`
        );

    if (initialOption) {
        selectStudent(
            initialOption.dataset.studentId,
            initialOption,
            dropdownMenu,
            dropdownButton,
            infoEl,
            true
        );
    }
}

export function loadStudentData() {
    try {
        handleSectionAnswers();
    } catch (err) {
        console.error("Ошибка при загрузке данных ученика:", err);
        showNotification("Не удалось загрузить данные ученика");
    }
}

function appendMenuItem(menu, { id, name }) {
    const li = document.createElement("li");
    li.innerHTML = `
        <a class="dropdown-item student-option text-black"
           href="#"
           data-student-id="${id}">
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
        <button class="dropdown-item text-warning"
                id="addStudentButton"
                type="button"
                data-bs-toggle="modal"
                data-bs-target="#invitationModal">
            <i class="bi bi-person-plus me-2"></i>
            Добавить ученика
        </button>
    `;
    return li;
}

async function selectStudent(
    studentId,
    itemEl,
    dropdownMenu,
    dropdownButton,
    infoEl,
    isInitial = false
) {
    dropdownMenu
        .querySelectorAll(".student-option")
        .forEach(i => i.classList.remove("active"));

    itemEl?.classList.add("active");

    dropdownButton.textContent = itemEl
        ? itemEl.textContent.trim()
        : studentId === "all"
            ? "Статистика"
            : String(studentId);

    infoEl.dataset.viewedUserId = String(studentId);

    if (isInitial) return;

    await clearAllTaskContainers();
    clearStatistics();

    safeInvoke(
        loadStudentData,
        "Не удалось загрузить данные ученика"
    );
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
        textEl && (textEl.textContent = "Разрешить копирование");
        btn.classList.replace("text-success", "text-danger");
        showNotification("Копирование запрещено");
    } else {
        document.body.classList.add("copy-allowed");
        document.body.style.userSelect = "text";
        icon?.classList.replace("bi-ban", "bi-check-lg");
        textEl && (textEl.textContent = "Запретить копирование");
        btn.classList.replace("text-danger", "text-success");
        showNotification("Копирование разрешено");
    }
}

function safeInvoke(fn, message) {
    try {
        fn();
    } catch (err) {
        console.error(message, err);
        showNotification(message);
    }
}

/**
 * Показывает кнопку "Перейти к заданию" и навешивает обработчик
 * @param {HTMLElement} panel
 */
export function renderGoToTaskButton(panel) {
    if (!panel) return;

    const btns = panel.querySelectorAll(".go-to-task-btn");
    if (!btns.length) return;

    btns.forEach(btn => {
        btn.classList.remove("d-none");
    });
}

/**
 * Показывает кнопку "Сбросить ответ" и навешивает обработчик
 * @param {HTMLElement} panel
 */
export function renderResetButton(panel) {
    if (!panel) return;

    const btns = panel.querySelectorAll(".reset-answer-btn");
    if (!btns.length) return;

    btns.forEach(btn => {
        btn.classList.remove("d-none");
    });
}