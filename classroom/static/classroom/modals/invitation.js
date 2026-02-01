import { showNotification, getCsrfToken } from "/static/js/tasks/utils.js";

export function initClassroomInviteModal(classroom_id, join_password) {
    if (!classroom_id) return;

    const modalEl = document.getElementById("classroomInviteModal");
    if (!modalEl) return;

    const inviteInput = modalEl.querySelector("#classroomInviteLink");
    const copyInviteBtn = modalEl.querySelector("#copyClassroomInviteLink");
    const passwordInput = modalEl.querySelector("#classroomPassword");
    const editBtn = modalEl.querySelector("#editPasswordBtn");
    const saveBtn = modalEl.querySelector("#savePasswordBtn");
    const cancelBtn = modalEl.querySelector("#cancelPasswordBtn");
    const passwordSection = modalEl.querySelector("#passwordSection");
    const setPasswordSection = modalEl.querySelector("#setPasswordSection");
    const setPasswordBtn = modalEl.querySelector("#setPasswordBtn");

    let originalPassword = join_password || "";

    const updateInviteLink = (password) => {
        const baseUrl = `${window.location.origin}/classroom/join/${classroom_id}/`;
        if (password) {
            inviteInput.value = `${baseUrl}?pw=${encodeURIComponent(password)}`;
        } else {
            inviteInput.value = baseUrl;
        }
    };

    updateInviteLink(originalPassword);

    if (originalPassword) {
        passwordSection.style.display = "block";
        setPasswordSection.style.display = "none";
        passwordInput.value = originalPassword;
    } else {
        passwordSection.style.display = "none";
        setPasswordSection.style.display = "block";
    }

    if (copyInviteBtn && !copyInviteBtn.dataset.bound) {
        copyInviteBtn.addEventListener("click", () => {
            inviteInput.select();
            inviteInput.setSelectionRange(0, inviteInput.value.length);
            document.execCommand("copy");
            showNotification("Ссылка скопирована");
        });
        copyInviteBtn.dataset.bound = "1";
    }

    if (setPasswordBtn && !setPasswordBtn.dataset.bound) {
        setPasswordBtn.addEventListener("click", () => {
            passwordSection.style.display = "block";
            setPasswordSection.style.display = "none";
            passwordInput.removeAttribute("readonly");
            passwordInput.value = "";
            passwordInput.focus();
            editBtn.classList.add("d-none");
            saveBtn.classList.remove("d-none");
            cancelBtn.classList.remove("d-none");
        });
        setPasswordBtn.dataset.bound = "1";
    }

    if (editBtn && !editBtn.dataset.bound) {
        editBtn.addEventListener("click", () => {
            passwordInput.removeAttribute("readonly");
            passwordInput.focus();
            editBtn.classList.add("d-none");
            saveBtn.classList.remove("d-none");
            cancelBtn.classList.remove("d-none");
        });
        editBtn.dataset.bound = "1";
    }

    const savePassword = async (isNew = false) => {
        const newPassword = passwordInput.value.trim();

        if (!/^\d{1,12}$/.test(newPassword)) {
            showNotification("Пароль должен быть числовым и не более 12 символов");
            return;
        }

        try {
            const response = await fetch(`/classroom/api/${classroom_id}/change-classroom-password/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCsrfToken(),
                },
                body: JSON.stringify({ password: newPassword }),
            });

            const data = await response.json();

            if (!data.ok) {
                showNotification(data.error || "Ошибка сервера");
                return;
            }

            originalPassword = data.password;
            passwordInput.value = originalPassword;
            passwordInput.setAttribute("readonly", "true");
            saveBtn.classList.add("d-none");
            cancelBtn.classList.add("d-none");
            editBtn.classList.remove("d-none");

            if (isNew) {
                passwordSection.style.display = "block";
                setPasswordSection.style.display = "none";
            }

            updateInviteLink(originalPassword);
            showNotification("Пароль сохранён");
        } catch (err) {
            showNotification("Ошибка сервера, попробуйте ещё раз");
        }
    };

    const saveNewPassword = async () => {
        await savePassword(true);
    };

    if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.addEventListener("click", () => {
            if (!originalPassword) {
                saveNewPassword();
            } else {
                savePassword(false);
            }
        });
        saveBtn.dataset.bound = "1";
    }

    if (cancelBtn && !cancelBtn.dataset.bound) {
        cancelBtn.addEventListener("click", () => {
            if (originalPassword) {
                passwordInput.value = originalPassword;
                passwordSection.style.display = "block";
                setPasswordSection.style.display = "none";
            } else {
                passwordSection.style.display = "none";
                setPasswordSection.style.display = "block";
            }
            passwordInput.setAttribute("readonly", "true");
            saveBtn.classList.add("d-none");
            cancelBtn.classList.add("d-none");
            editBtn.classList.remove("d-none");
            updateInviteLink(originalPassword);
        });
        cancelBtn.dataset.bound = "1";
    }

    passwordInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !passwordInput.hasAttribute("readonly")) {
            e.preventDefault();
            if (!originalPassword) {
                saveNewPassword();
            } else {
                savePassword(false);
            }
        }
    });
}