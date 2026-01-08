import { showNotification, escapeHtml, getInfoElement, getCurrentUserId } from "/static/js/tasks/utils.js";
import { eventBus } from "/static/js/tasks/events/eventBus.js";
import { getViewedUserId } from '/static/classroom/utils.js'
import { formatStudentName } from '/static/classroom/answers/utils.js'
import { handleSectionAnswers } from "/static/classroom/answers/handleAnswer.js";
import { clearAllTaskContainers } from "/static/classroom/answers/handlers/clearAnswers.js";
import { clearStatistics, loadSectionStatistics } from "/static/classroom/answers/handlers/statistics.js";


let statsInterval = null;

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

        if (statsInterval) {
            clearInterval(statsInterval);
            statsInterval = null;
        }

        selectStudent(studentId, item, dropdownMenu, dropdownButton, infoEl);

        if (studentId === "all") {
            statsInterval = setInterval(loadSectionStatistics, 5000);
        }
    });

    if (disableCopyingButton) disableCopyingButton.addEventListener("click", toggleCopying);
    if (refreshPageButton) refreshPageButton.addEventListener("click", () => location.reload());

    const initialId = String(getViewedUserId());
    const initialOption =
        dropdownMenu.querySelector(`.student-option[data-student-id="${initialId}"]`) ||
        dropdownMenu.querySelector(`.student-option[data-student-id="all"]`);

    if (initialOption) {
        const studentId = initialOption.dataset.studentId;
        selectStudent(studentId, initialOption, dropdownMenu, dropdownButton, infoEl, true);

        if (studentId === "all") {
            loadSectionStatistics();
            statsInterval = setInterval(loadSectionStatistics, 5000);
        }
    }

    // Проверка онлайн-статуса всех студентов каждые 90 секунд
    if (Array.isArray(studentsList) && studentsList.length > 0) {
        const checkAllStudents = () => {
            studentsList.forEach(s => {
                checkUserOnline(s.id);
            });
        };

        checkAllStudents();
        setInterval(checkAllStudents, 90000);
    }
}

/**
 * Добавляет зелёный кружок рядом с пользователем, справа
 * @param {string|number} userId
 */
export function markUserOnline(userId) {
    const option = document.querySelector(`.student-option[data-student-id="${userId}"]`);
    if (!option) return;

    if (!option.querySelector(".option-flex")) {
        const wrapper = document.createElement("span");
        wrapper.className = "option-flex d-flex justify-content-between align-items-center";
        wrapper.style.width = "100%";

        const textNode = document.createElement("span");
        textNode.textContent = option.textContent.trim();
        wrapper.appendChild(textNode);

        option.textContent = "";
        option.appendChild(wrapper);
    }

    const wrapper = option.querySelector(".option-flex");

    let indicator = wrapper.querySelector(".online-indicator");
    if (!indicator) {
        indicator = document.createElement("span");
        indicator.className = "online-indicator";
        indicator.style.display = "inline-block";
        indicator.style.width = "10px";
        indicator.style.height = "10px";
        indicator.style.borderRadius = "50%";
        indicator.style.backgroundColor = "green";
        wrapper.appendChild(indicator);
    }
    indicator.style.backgroundColor = "green";
}

/**
 * Убирает зелёный кружок
 * @param {string|number} userId
 */
export function markUserOffline(userId) {
    const option = document.querySelector(`.student-option[data-student-id="${userId}"]`);
    if (!option) return;

    const wrapper = option.querySelector(".option-flex");
    if (!wrapper) return;

    const indicator = wrapper.querySelector(".online-indicator");
    if (indicator) {
        indicator.remove();
    }
}

export let onlineTimers = {};

/**
 * Проверяет, онлайн ли пользователь, с таймером ожидания.
 * @param {string|number} userId
 */
export function checkUserOnline(userId) {
    if (onlineTimers[userId]) {
        clearTimeout(onlineTimers[userId]);
    }

    onlineTimers[userId] = setTimeout(() => {
        markUserOffline(userId);
        delete onlineTimers[userId];
    }, 1000);

    const randomDelay = Math.floor(Math.random() * 500);

    setTimeout(() => {
        eventBus.emit("user:is_online", { userId, timerId: onlineTimers[userId] });
    }, randomDelay);
}

/**
 * Показывает все скрытые элементы управления панели
 */
export function showAllPanelElements() {
    const addStudentButton = document.getElementById('addStudentButton');
    if (addStudentButton) {
        addStudentButton.classList.remove('d-none');
    }

    const panelDivider = document.getElementById('panelDivider');
    if (panelDivider) {
        panelDivider.classList.remove('d-none');
    }

    const statisticsDropdown = document.getElementById('statisticsDropdown');
    if (statisticsDropdown) {
        statisticsDropdown.classList.remove('d-none');
    }

    const menuDropdown = document.getElementById('menuDropdown');
    if (menuDropdown) {
        menuDropdown.classList.remove('d-none');
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
    const safeName = String(name);
    const displayName =
        safeName.length > 20
            ? `${safeName.slice(0, 20)}…`
            : safeName;

    const li = document.createElement("li");
    li.innerHTML = `
        <a class="dropdown-item student-option text-black"
           href="#"
           data-student-id="${id}"
           title="${escapeHtml(safeName)}">
            ${escapeHtml(displayName)}
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

    const fullName = itemEl
        ? itemEl.textContent.trim()
        : studentId === "all"
            ? "Статистика"
            : String(studentId);
    dropdownButton.textContent = formatStudentName(fullName);

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