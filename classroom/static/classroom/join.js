import { getCsrfToken, showNotification, getInfoElement } from "js/tasks/utils.js";

const infoEl = getInfoElement();
const classroomId = infoEl.dataset.classroomId;
const loginUrl = infoEl.dataset.loginUrl;
const initialPassword = infoEl.dataset.initialPassword || "";

let passwordVerified = infoEl.dataset.passwordVerified === "true";
let selectedRole = "student";

const roleModalEl = document.getElementById("roleSelectModal");
const passwordModalEl = document.getElementById("classroomPasswordModal");
const nameModalEl = document.getElementById("studentNameModal");

const roleModal = new bootstrap.Modal(roleModalEl, { backdrop: "static", keyboard: false });
const passwordModal = new bootstrap.Modal(passwordModalEl, { backdrop: "static", keyboard: false });
const nameModal = new bootstrap.Modal(nameModalEl, { backdrop: "static", keyboard: false });

const roleStudentBtn = document.getElementById("roleStudentBtn");
const roleTeacherBtn = document.getElementById("roleTeacherBtn");
const submitRoleBtn = document.getElementById("submitRoleBtn");

const passwordInput = document.getElementById("classroomPasswordInput");
const passwordError = document.getElementById("passwordError");
const submitPasswordBtn = document.getElementById("submitPasswordBtn");
const backFromPasswordBtn = document.getElementById("backFromPassword");

const firstNameInput = document.getElementById("studentFirstNameInput");
const lastNameInput = document.getElementById("studentLastNameInput");
const nameError = document.getElementById("nameError");
const submitNameBtn = document.getElementById("submitNameBtn");
const backFromNameBtn = document.getElementById("backFromNameBtn");

const namePattern = /^[A-Za-zА-Яа-яЁё\-\/]{1,18}$/;

roleModalEl.addEventListener('shown.bs.modal', function () {
    setTimeout(() => roleStudentBtn.focus(), 50);
});

passwordModalEl.addEventListener('shown.bs.modal', function () {
    if (initialPassword && !passwordInput.value) {
        passwordInput.value = initialPassword;
        submitPasswordBtn.disabled = false;
    }
    setTimeout(() => passwordInput.focus(), 50);
});

nameModalEl.addEventListener('shown.bs.modal', function () {
    setTimeout(() => firstNameInput.focus(), 50);
});

roleStudentBtn.addEventListener("click", () => {
    selectedRole = "student";
    roleStudentBtn.classList.add("active");
    roleTeacherBtn.classList.remove("active");
});

roleTeacherBtn.addEventListener("click", () => {
    selectedRole = "teacher";
    roleTeacherBtn.classList.add("active");
    roleStudentBtn.classList.remove("active");
});

submitRoleBtn.addEventListener("click", () => {
    if (selectedRole === "teacher") {
        const currentUrl = encodeURIComponent(window.location.href);
        window.location.href = loginUrl + '?next=' + currentUrl;
        return;
    }

    submitRoleBtn.disabled = true;
    submitRoleBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>';

    setTimeout(() => {
        roleModal.hide();
        submitRoleBtn.disabled = false;
        submitRoleBtn.innerHTML = 'Далее';
        setTimeout(() => {
            if (passwordVerified) {
                nameModal.show();
            } else {
                passwordModal.show();
            }
        }, 300);
    }, 200);
});

passwordInput.addEventListener("input", () => {
    submitPasswordBtn.disabled = passwordInput.value.trim().length === 0;
});

backFromPasswordBtn.addEventListener("click", () => {
    backFromPasswordBtn.disabled = true;

    setTimeout(() => {
        passwordModal.hide();
        backFromPasswordBtn.disabled = false;
        setTimeout(() => {
            roleModal.show();
        }, 300);
    }, 200);
});

submitPasswordBtn.addEventListener("click", async () => {
    const password = passwordInput.value.trim();
    if (!password) return;

    passwordError.classList.add("d-none");
    submitPasswordBtn.disabled = true;
    const originalText = submitPasswordBtn.innerHTML;
    submitPasswordBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>';

    try {
        const response = await fetch(
            `/classroom/join/${classroomId}/verify-password/`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCsrfToken(),
                },
                body: JSON.stringify({ password }),
            }
        );

        const data = await response.json();

        submitPasswordBtn.disabled = false;
        submitPasswordBtn.innerHTML = originalText;

        if (!data.ok) {
            passwordError.textContent = data.error || "Неверный пароль";
            passwordError.classList.remove("d-none");
            return;
        }

        if (data.redirect) {
            window.location.href = data.redirect;
            return;
        }

        passwordVerified = true;
        passwordModal.hide();
        setTimeout(() => {
            nameModal.show();
        }, 300);
    } catch {
        submitPasswordBtn.disabled = false;
        submitPasswordBtn.innerHTML = originalText;
        passwordError.textContent = "Ошибка сервера, попробуйте ещё раз";
        passwordError.classList.remove("d-none");
    }
});

backFromNameBtn.addEventListener("click", () => {
    backFromNameBtn.disabled = true;

    setTimeout(() => {
        nameModal.hide();
        backFromNameBtn.disabled = false;
        setTimeout(() => {
            if (passwordVerified) {
                passwordModal.show();
            } else {
                roleModal.show();
            }
        }, 300);
    }, 200);
});

submitNameBtn.addEventListener("click", async () => {
    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();

    if (!firstName || !lastName || !namePattern.test(firstName) || !namePattern.test(lastName)) {
        nameError.classList.remove("d-none");
        return;
    }

    nameError.classList.add("d-none");
    submitNameBtn.disabled = true;
    const originalText = submitNameBtn.innerHTML;
    submitNameBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>';

    try {
        const response = await fetch(
            `/classroom/join/${classroomId}/finalize/`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCsrfToken(),
                },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                }),
            }
        );

        const data = await response.json();

        setTimeout(() => {
            submitNameBtn.disabled = false;
            submitNameBtn.innerHTML = originalText;
        }, 5000);

        if (!data.ok) {
            showNotification(data.error || "Ошибка сервера");
            return;
        }

        if (data.redirect) {
            window.location.href = data.redirect;
        }
    } catch {
        submitNameBtn.disabled = false;
        submitNameBtn.innerHTML = originalText;
        showNotification("Ошибка сервера, попробуйте ещё раз");
    }
});

firstNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        lastNameInput.focus();
    }
});

lastNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        submitNameBtn.click();
    }
});

function setupEnterKeyBindings() {
    roleModalEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            submitRoleBtn.click();
        }
    });

    passwordModalEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            submitPasswordBtn.click();
        }
    });
}

function init() {
    setupEnterKeyBindings();
    roleModal.show();
}

document.addEventListener("DOMContentLoaded", init);