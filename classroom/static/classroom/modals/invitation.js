import { showNotification, getCsrfToken } from "/static/js/tasks/utils.js";

export function initClassroomInviteModal(classroom_id, join_password) {
    if (!classroom_id || !join_password) return;

    const modalEl = document.getElementById("classroomInviteModal");
    if (!modalEl) return;

    const inviteInput = modalEl.querySelector("#classroomInviteLink");
    const copyInviteBtn = modalEl.querySelector("#copyClassroomInviteLink");
    const passwordInput = modalEl.querySelector("#classroomPassword");
    const editBtn = modalEl.querySelector("#editPasswordBtn");
    const saveBtn = modalEl.querySelector("#savePasswordBtn");
    const cancelBtn = modalEl.querySelector("#cancelPasswordBtn");

    let originalPassword = join_password;

    const updateInviteLink = (password) => {
        inviteInput.value = `${window.location.origin}/classroom/join/${classroom_id}/?pw=${encodeURIComponent(password)}`;
    };

    passwordInput.value = originalPassword;
    updateInviteLink(originalPassword);

    if (copyInviteBtn && !copyInviteBtn.dataset.bound) {
        copyInviteBtn.addEventListener("click", () => {
            inviteInput.select();
            inviteInput.setSelectionRange(0, inviteInput.value.length);
            document.execCommand("copy");
            showNotification("Ссылка скопирована");
        });
        copyInviteBtn.dataset.bound = "1";
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

    const savePassword = async () => {
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

            updateInviteLink(originalPassword);
            showNotification("Пароль изменён");
        } catch (err) {
            showNotification("Ошибка сервера, попробуйте ещё раз");
        }
    };

    if (saveBtn && !saveBtn.dataset.bound) {
        saveBtn.addEventListener("click", savePassword);
        saveBtn.dataset.bound = "1";
    }

    if (cancelBtn && !cancelBtn.dataset.bound) {
        cancelBtn.addEventListener("click", () => {
            passwordInput.value = originalPassword;
            passwordInput.setAttribute("readonly", "true");
            saveBtn.classList.add("d-none");
            cancelBtn.classList.add("d-none");
            editBtn.classList.remove("d-none");
            updateInviteLink(originalPassword);
        });
        cancelBtn.dataset.bound = "1";
    }

    // Сохраняем пароль по Enter
    passwordInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !passwordInput.hasAttribute("readonly")) {
            e.preventDefault();
            savePassword();
        }
    });
}
