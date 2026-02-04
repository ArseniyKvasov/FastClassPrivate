/**
 * Рендерит задание со свободным текстовым вводом
 * @param {Object} task - Объект задания
 * @param {Object} task.data - Данные задания
 * @param {string} [task.data.prompt] - Текст задания
 * @param {string} [task.data.default_text] - Текст по умолчанию
 * @param {HTMLElement} container - Контейнер для рендеринга
 */
export function renderTextInputTask(task, container) {
    if (!container) return;

    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "text-input-task";

    if (task.data.prompt) {
        const promptLabel = document.createElement("label");
        promptLabel.className = "form-label fw-semibold mb-1";
        promptLabel.textContent = task.data.prompt;
        wrapper.appendChild(promptLabel);
    }

    const textarea = document.createElement("textarea");
    textarea.className = "form-control";
    textarea.value = task.data.default_text || "";
    textarea.rows = 2;
    textarea.style.resize = "none";
    textarea.style.overflowY = "auto";

    const adjustHeight = () => {
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
        const paddingTop = parseInt(getComputedStyle(textarea).paddingTop) || 6;
        const paddingBottom = parseInt(getComputedStyle(textarea).paddingBottom) || 6;

        const minHeight = lineHeight * 2 + paddingTop + paddingBottom;
        const maxHeight = lineHeight * 8 + paddingTop + paddingBottom;

        textarea.style.height = "auto";
        const scrollHeight = textarea.scrollHeight;

        if (scrollHeight <= maxHeight) {
            textarea.style.height = Math.max(scrollHeight, minHeight) + "px";
            textarea.style.overflowY = "hidden";
        } else {
            textarea.style.height = maxHeight + "px";
            textarea.style.overflowY = "auto";

            textarea.style.scrollbarWidth = "thin";
            textarea.style.scrollbarColor = "#adb5bd #f8f9fa";
        }
    };

    textarea.addEventListener("input", adjustHeight);

    window.addEventListener("resize", adjustHeight);

    const cleanup = () => {
        window.removeEventListener("resize", adjustHeight);
    };

    requestAnimationFrame(adjustHeight);

    wrapper.appendChild(textarea);
    container.appendChild(wrapper);

    return cleanup;
}