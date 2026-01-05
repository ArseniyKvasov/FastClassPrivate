import { showNotification, escapeHtml } from "@tasks/utils";

/**
 * Инициализирует панель управления учениками.
 *
 * @param {Array<{id: number|string, name: string}>} studentsList
 */
export function initStudentPanel(studentsList = []) {
    const dropdownMenu = document.getElementById("studentDropdownMenu");
    const dropdownButton = document.getElementById("studentDropdown");
    const invitationModalEl = document.getElementById("invitationModal");
    const disableCopyingButton = document.getElementById("disableCopyingButton");
    const refreshPageButton = document.getElementById("refreshPageButton");

    if (!dropdownMenu || !dropdownButton) return;

    let selectedStudentId = null;

    dropdownMenu.innerHTML = "";
    appendMenuItem(dropdownMenu, { id: "all", name: "Все ученики", isLink: true });

    if (Array.isArray(studentsList) && studentsList.length > 0) {
        appendDivider(dropdownMenu);
        studentsList.forEach(s => appendMenuItem(dropdownMenu, { id: String(s.id), name: s.name, isLink: true }));
        appendDivider(dropdownMenu);
        const addStudentBtn = document.createElement("li");
        addStudentBtn.innerHTML = `
            <button class="dropdown-item text-warning" id="addStudentButton" data-bs-toggle="modal" data-bs-target="#invitationModal" type="button">
                <i class="bi bi-person-plus me-2" aria-hidden="true"></i> Добавить ученика
            </button>
        `;
        dropdownMenu.appendChild(addStudentBtn);
    }

    dropdownMenu.addEventListener("click", (event) => {
        const item = event.target.closest(".dropdown-item");
        if (!item) return;
        if (item.id === "addStudentButton") {
            event.preventDefault();
            if (invitationModalEl && typeof bootstrap !== "undefined") {
                const modal = new bootstrap.Modal(invitationModalEl);
                modal.show();
            }
            return;
        }
        event.preventDefault();
        const studentId = item.dataset.studentId;
        selectStudent(studentId, item, dropdownMenu, dropdownButton);
    });

    if (disableCopyingButton) {
        disableCopyingButton.addEventListener("click", (e) => {
            e.preventDefault();
            const isAllowed = document.body.classList.contains("copy-allowed");
            const icon = disableCopyingButton.querySelector("i");
            const textEl = disableCopyingButton.querySelector(".text");

            if (isAllowed) {
                document.body.classList.remove("copy-allowed");
                document.body.style.userSelect = "none";
                if (icon) {
                    icon.classList.remove("bi-check-lg");
                    icon.classList.add("bi-ban");
                }
                if (textEl) textEl.textContent = "Разрешить копирование";
                disableCopyingButton.classList.remove("text-success");
                disableCopyingButton.classList.add("text-danger");
                showNotification("Копирование запрещено");
            } else {
                document.body.classList.add("copy-allowed");
                document.body.style.userSelect = "text";
                if (icon) {
                    icon.classList.remove("bi-ban");
                    icon.classList.add("bi-check-lg");
                }
                if (textEl) textEl.textContent = "Запретить копирование";
                disableCopyingButton.classList.remove("text-danger");
                disableCopyingButton.classList.add("text-success");
                showNotification("Копирование разрешено");
            }
        });
    }

    if (refreshPageButton) {
        refreshPageButton.addEventListener("click", () => {
            location.reload();
        });
    }

    const initialId = String(typeof getViewedUserId === "function" ? getViewedUserId() : (studentsList && studentsList.length ? String(studentsList[0].id) : "all"));
    const initialOption = dropdownMenu.querySelector(`.student-option[data-student-id="${initialId}"]`) || dropdownMenu.querySelector(`.student-option[data-student-id="all"]`);
    if (initialOption) Promise.resolve().then(() => selectStudent(initialOption.dataset.studentId, initialOption, dropdownMenu, dropdownButton));
}

/**
 * Загружает данные выбранного ученика.
 *
 * @param {string|number} studentId
 */
export function loadStudentData(studentId) {
    const sid = String(studentId);
    try {
        if (typeof handleSectionAnswers === "function") {
            handleSectionAnswers();
            return;
        }
        if (typeof loadStudentAnswers === "function") {
            loadStudentAnswers(sid);
            return;
        }
        if (typeof loadStudentTasks === "function") {
            loadStudentTasks(sid);
            return;
        }
        throw new Error("Нет функции для загрузки данных ученика");
    } catch (err) {
        console.error("Ошибка при загрузке данных ученика:", err);
        try { showNotification("Не удалось загрузить данные ученика"); } catch (e) {}
    }
}

function appendMenuItem(menu, opts) {
    const li = document.createElement("li");
    if (opts.isLink) {
        const safeName = escapeHtml(String(opts.name));
        li.innerHTML = `<a class="dropdown-item student-option" href="#" data-student-id="${opts.id}">${safeName}</a>`;
    } else {
        li.innerHTML = opts.html || "";
    }
    menu.appendChild(li);
}

function appendDivider(menu) {
    const divider = document.createElement("li");
    divider.innerHTML = '<hr class="dropdown-divider">';
    menu.appendChild(divider);
}

function selectStudent(studentId, itemEl, dropdownMenu, dropdownButton) {
    dropdownMenu.querySelectorAll(".student-option").forEach(i => i.classList.remove("active"));
    let chosenEl = itemEl || dropdownMenu.querySelector(`.student-option[data-student-id="${String(studentId)}"]`);
    if (chosenEl) chosenEl.classList.add("active");
    const label = chosenEl ? chosenEl.textContent.trim() : (studentId === "all" ? "Все ученики" : String(studentId));
    dropdownButton.textContent = label;
    if (String(studentId) === "all") {
        safeInvoke(() => {
            if (typeof loadSectionStatistics === "function") loadSectionStatistics();
            else if (typeof handleSectionAnswers === "function") handleSectionAnswers();
        }, "Не удалось загрузить статистику по разделу");
    } else {
        safeInvoke(() => loadStudentData(studentId), "Не удалось загрузить данные ученика");
    }
}

function safeInvoke(fn, errorMessage) {
    try {
        fn();
    } catch (err) {
        console.error(errorMessage, err);
        try { showNotification(errorMessage); } catch (e) {}
    }
}
