export function renderTextInputTask(task, container) {
    if (!container) return;

    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "text-input-task";

    const promptLabel = document.createElement("label");
    promptLabel.className = "form-label fw-semibold mb-1 text-center"; // добавили text-center
    promptLabel.style.display = "block"; // чтобы text-align работал
    promptLabel.textContent = task.prompt || "Задание";

    const textarea = document.createElement("textarea");
    textarea.className = "form-control";
    textarea.value = task.default_text || "";
    textarea.rows = 2;
    textarea.style.resize = "none";
    textarea.style.overflow = "hidden";

    const adjustHeight = () => {
        textarea.rows = 2;
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
        const lines = Math.ceil(textarea.scrollHeight / lineHeight);
        textarea.rows = Math.min(Math.max(lines, 2), 8);
    };

    textarea.addEventListener("input", adjustHeight);
    adjustHeight();

    wrapper.appendChild(promptLabel);
    wrapper.appendChild(textarea);
    container.appendChild(wrapper);
}
