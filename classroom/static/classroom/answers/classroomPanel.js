import { showNotification, escapeHtml, getInfoElement, getCsrfToken, confirmAction, getCurrentUserId } from "/static/js/tasks/utils.js";
import { eventBus } from "/static/js/tasks/events/eventBus.js";
import { startTasksOrderEditing } from "/static/js/tasks/editor/changeTasksOrder.js";
import { getViewedUserId, getClassroomId, getUsernameById } from "/static/classroom/utils.js";
import { formatStudentName } from "/static/classroom/answers/utils.js";
import { handleSectionAnswers } from "/static/classroom/answers/handleAnswer.js";
import { clearAllTaskContainers } from "/static/classroom/answers/handlers/clearAnswers.js";
import { clearStatistics, loadSectionStatistics } from "/static/classroom/answers/handlers/statistics.js";
import { disableCopying, enableCopying } from "/static/classroom/copyingMode.js";

let statsInterval = null;
let classroomInviteModalInstance = null;

function ensureClassroomInviteModal() {
    if (classroomInviteModalInstance) return classroomInviteModalInstance;
    const modalEl = document.getElementById("classroomInviteModal");
    if (!modalEl) return null;
    classroomInviteModalInstance = new bootstrap.Modal(modalEl);
    return classroomInviteModalInstance;
}

function createStudentItem(studentId, name) {
    const safeName = String(name);
    const displayName = safeName.length > 20 ? `${safeName.slice(0, 20)}…` : safeName;

    const showIndicators = !["all", getCurrentUserId()].includes(studentId);

    const li = document.createElement("li");
    li.className = "student-menu-item";

    if (showIndicators) {
        li.innerHTML = `
            <a class="dropdown-item student-option text-black d-flex align-items-center"
               href="#"
               data-student-id="${escapeHtml(String(studentId))}"
               title="${escapeHtml(safeName)}">
                <span class="student-name flex-grow-1">${escapeHtml(displayName)}</span>

                <span class="student-action-slot ms-2">
                    <span class="online-indicator"></span>
                    <i class="bi bi-x student-delete-icon"></i>
                </span>
            </a>
        `;
    } else {
        li.innerHTML = `
            <a class="dropdown-item student-option text-black d-flex align-items-center"
               href="#"
               data-student-id="${escapeHtml(String(studentId))}"
               title="${escapeHtml(safeName)}">
                <span class="student-name flex-grow-1">${escapeHtml(displayName)}</span>
            </a>
        `;
    }

    const link = li.querySelector(".student-option");

    if (showIndicators) {
        const slot = li.querySelector(".student-action-slot");
        const indicator = li.querySelector(".online-indicator");
        const deleteIcon = li.querySelector(".student-delete-icon");

        Object.assign(slot.style, {
            width: "14px",
            height: "14px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative"
        });

        Object.assign(indicator.style, {
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            display: "none"
        });

        Object.assign(deleteIcon.style, {
            display: "none",
            opacity: ".6",
            cursor: "pointer",
            fontSize: "14px",
            lineHeight: "1"
        });

        link.addEventListener("mouseenter", () => {
            indicator.style.display = "none";
            deleteIcon.style.display = "block";
        });

        link.addEventListener("mouseleave", () => {
            if (indicator.style.backgroundColor && indicator.style.backgroundColor !== "transparent") {
                indicator.style.display = "block";
            }
            deleteIcon.style.display = "none";
        });

        let touchTimer;
        link.addEventListener("touchstart", () => {
            touchTimer = setTimeout(() => {
                indicator.style.display = "none";
                deleteIcon.style.display = "block";
            }, 500);
        });

        link.addEventListener("touchend", () => clearTimeout(touchTimer));
        link.addEventListener("touchmove", () => clearTimeout(touchTimer));

        deleteIcon.addEventListener("mouseenter", () => {
            deleteIcon.style.opacity = "1";
        });

        deleteIcon.addEventListener("mouseleave", () => {
            deleteIcon.style.opacity = ".6";
        });

        deleteIcon.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            try {
                const confirmed = await confirmAction("Вы уверены, что хотите удалить ученика?");
                if (!confirmed) return;

                const classroomId = getClassroomId();
                const response = await fetch(`/classroom/api/${classroomId}/delete-student/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCsrfToken()
                    },
                    body: JSON.stringify({ student_id: studentId })
                });

                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || "Ошибка при удалении ученика");
                }

                li.remove();
                eventBus.emit("user:delete", studentId);
                showNotification("Ученик удалён. Обновите пароль класса через кнопку «Добавить ученика».", 6);

                const currentViewedId = getViewedUserId();
                if (String(currentViewedId) === studentId) {
                    await selectStudent("all", false);
                }
            } catch (error) {
                console.error("Ошибка при удалении ученика:", error);
                showNotification(error.message || "Не удалось удалить ученика", "error");
            }
        });
    }

    return li;
}

async function selectStudent(studentId, isInitial = false) {
    const dropdownMenu = document.getElementById("studentDropdownMenu");
    const dropdownButton = document.getElementById("studentDropdown");
    const infoEl = getInfoElement();

    if (!dropdownMenu || !dropdownButton || !infoEl) {
        console.warn("Элементы UI не найдены для selectStudent");
        return;
    }

    const itemEl = dropdownMenu.querySelector(`.student-option[data-student-id="${studentId}"]`);

    if (itemEl && !isInitial) {
        itemEl.classList.add("disabled");
        itemEl.style.pointerEvents = "none";
        itemEl.style.opacity = "0.6";

        setTimeout(() => {
            itemEl.classList.remove("disabled");
            itemEl.style.pointerEvents = "";
            itemEl.style.opacity = "";
        }, 3000);
    }

    dropdownMenu.querySelectorAll(".student-option").forEach(i => i.classList.remove("active"));
    itemEl?.classList.add("active");

    const fullName = itemEl
        ? itemEl.querySelector('.student-name')?.textContent.trim() || itemEl.textContent.trim()
        : studentId === "all"
            ? "Статистика"
            : String(studentId);
    dropdownButton.textContent = formatStudentName(fullName);

    infoEl.dataset.viewedUserId = String(studentId);
    infoEl.dataset.studentUsername = String(fullName);

    if (isInitial) return;

    if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
    }

    await clearAllTaskContainers();
    clearStatistics();

    if (studentId === "all") {
        loadSectionStatistics();
        statsInterval = setInterval(loadSectionStatistics, 5000);
    } else {
        try {
            handleSectionAnswers();
        } catch (err) {
            console.error("Ошибка при загрузке данных ученика:", err);
            showNotification("Не удалось загрузить данные ученика");
        }
    }
}

export async function markUserOnline(userId) {
    const dropdownMenu = document.getElementById("studentDropdownMenu");
    if (!dropdownMenu) return;

    let option = dropdownMenu.querySelector(`.student-option[data-student-id="${userId}"]`);

    if (!option) {
        try {
            const username = await getUsernameById(userId);
            if (username) {
                const li = createStudentItem(String(userId), username);
                dropdownMenu.appendChild(li);
                option = dropdownMenu.querySelector(`.student-option[data-student-id="${userId}"]`);
            }
        } catch (error) {
            console.error("Ошибка при получении имени пользователя:", error);
            return;
        }
    }

    if (!option) return;

    const indicator = option.querySelector(".online-indicator");
    if (indicator) {
        indicator.style.backgroundColor = "green";
        indicator.style.display = "inline-block";
    }
}

export function markUserOffline(userId) {
    const option = document.querySelector(`.student-option[data-student-id="${userId}"]`);
    if (!option) return;

    const indicator = option.querySelector(".online-indicator");
    if (indicator) {
        indicator.style.backgroundColor = "transparent";
        indicator.style.display = "none";
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

export function loadStudentData() {
    try {
        handleSectionAnswers();
    } catch (err) {
        console.error("Ошибка при загрузке данных ученика:", err);
        showNotification("Не удалось загрузить данные ученика");
    }
}

export function showAllPanelElements() {
    const addStudentButton = document.getElementById('addStudentButton');
    if (addStudentButton) addStudentButton.classList.remove('d-none');

    const panelDivider = document.getElementById('panelDivider');
    if (panelDivider) panelDivider.classList.remove('d-none');

    const statisticsDropdown = document.getElementById('statisticsDropdown');
    if (statisticsDropdown) statisticsDropdown.classList.remove('d-none');

    const menuDropdown = document.getElementById('menuDropdown');
    if (menuDropdown) menuDropdown.classList.remove('d-none');
}

async function initCopyingButton(btn) {
    if (!btn) return;

    let allowed = btn.dataset.copyAllowed === "true";
    applyCopyingState(btn, allowed, true);

    btn.addEventListener("click", async (e) => {
        e.preventDefault();

        allowed = !allowed;
        const classroomId = getClassroomId();

        try {
            const res = await fetch(`/classroom/api/${classroomId}/set-copying-enabled/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCsrfToken()
                },
                body: JSON.stringify({ enabled: allowed })
            });

            if (!res.ok) throw new Error("Ошибка сервера");

            const data = await res.json();
            allowed = data.copying_enabled;
            eventBus.emit("copying:changed", { allowed });
            applyCopyingState(btn, allowed, false);
        } catch (err) {
            console.error(err);
            showNotification("Не удалось сменить режим копирования");
        }
    });
}

function applyCopyingState(btn, allowed, isInitial = false) {
    btn.dataset.copyAllowed = allowed ? "true" : "false";

    const icon = btn.querySelector("i");
    const textEl = btn.querySelector(".btn-text");

    if (allowed) {
        enableCopying();
        icon?.classList.replace("bi-check-lg", "bi-ban");
        textEl.textContent = "Запретить копирование";
        btn.classList.replace("text-success", "text-danger");
        if (!isInitial) showNotification("Копирование разрешено");
    } else {
        disableCopying();
        icon?.classList.replace("bi-ban", "bi-check-lg");
        textEl.textContent = "Разрешить копирование";
        btn.classList.replace("text-danger", "text-success");
        if (!isInitial) showNotification("Копирование запрещено");
    }
}

export function renderGoToTaskButton(panel) {
    if (!panel) return;
    const btns = panel.querySelectorAll(".go-to-task-btn");
    if (!btns.length) return;
    btns.forEach(btn => btn.classList.remove("d-none"));
}

export function renderResetButton(panel) {
    if (!panel) return;
    const btns = panel.querySelectorAll(".reset-answer-btn");
    if (!btns.length) return;
    btns.forEach(btn => btn.classList.remove("d-none"));
}

export async function initStudentPanel(studentsList = []) {
    const panelEl = document.getElementById("panel");
    const dropdownButton = document.getElementById("studentDropdown");
    const dropdownMenu = document.getElementById("studentDropdownMenu");
    const disableCopyingButton = document.getElementById("disableCopyingButton");
    const changeTasksOrderButton = document.getElementById("changeTasksOrderButton");
    const addStudentButton = document.getElementById("addStudentButton");
    const infoEl = getInfoElement();

    if (!panelEl || !dropdownButton || !dropdownMenu || !infoEl) return;

    dropdownMenu.innerHTML = "";
    dropdownMenu.appendChild(createStudentItem("all", "Статистика"));

    if (Array.isArray(studentsList) && studentsList.length > 0) {
        studentsList.forEach(s => {
            dropdownMenu.appendChild(createStudentItem(String(s.id), s.name));
        });
    }

    if (!dropdownMenu.dataset.bound) {
        dropdownMenu.addEventListener("click", event => {
            if (event.target.closest('.student-delete-icon')) return;

            const item = event.target.closest(".dropdown-item");
            if (!item) return;
            event.preventDefault();

            const studentId = item.dataset.studentId;
            if (!studentId) return;

            selectStudent(studentId, false);
        });
        dropdownMenu.dataset.bound = "1";
    }

    if (disableCopyingButton && !disableCopyingButton.dataset.bound) {
        initCopyingButton(disableCopyingButton);
        disableCopyingButton.dataset.bound = "1";
    }

    if (changeTasksOrderButton && !changeTasksOrderButton.dataset.bound) {
        changeTasksOrderButton.addEventListener("click", () => startTasksOrderEditing());
        changeTasksOrderButton.dataset.bound = "1";
    }

    if (addStudentButton && !addStudentButton.dataset.bound) {
        addStudentButton.addEventListener("click", () => {
            const modal = ensureClassroomInviteModal();
            if (modal) modal.show();
        });
        addStudentButton.dataset.bound = "1";
    }

    const initialId = String(getViewedUserId());
    const initialOption =
        dropdownMenu.querySelector(`.student-option[data-student-id="${initialId}"]`) ||
        dropdownMenu.querySelector(`.student-option[data-student-id="all"]`);

    if (initialOption) {
        const studentId = initialOption.dataset.studentId;
        await selectStudent(studentId, true);
    }
}