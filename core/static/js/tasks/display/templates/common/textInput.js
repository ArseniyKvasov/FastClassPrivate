import { escapeHtml } from "/static/js/tasks/utils.js";
import { createRichTextEditor } from "/static/js/tasks/editor/textFormatting.js";

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

    const { editor, getHTML, setHTML } = createRichTextEditor(task.data.default_text || "");

    editor.classList.add("form-control");
    editor.style.resize = "none";
    editor.style.overflowY = "auto";
    editor.style.minHeight = "120px";

    const adjustHeight = () => {
        const lineHeight = parseInt(getComputedStyle(editor).lineHeight) || 16;
        const paddingTop = parseInt(getComputedStyle(editor).paddingTop) || 6;
        const paddingBottom = parseInt(getComputedStyle(editor).paddingBottom) || 6;

        const minHeight = lineHeight * 7 + paddingTop + paddingBottom;
        const maxHeight = lineHeight * 15 + paddingTop + paddingBottom;

        editor.style.height = "auto";
        const scrollHeight = editor.scrollHeight;

        if (scrollHeight <= maxHeight) {
            editor.style.height = Math.max(scrollHeight, minHeight) + "px";
            editor.style.overflowY = "scroll";
        } else {
            editor.style.height = maxHeight + "px";
            editor.style.overflowY = "auto";
            editor.style.scrollbarWidth = "thin";
            editor.style.scrollbarColor = "#adb5bd #f8f9fa";
        }
    };

    editor.addEventListener("input", adjustHeight);
    window.addEventListener("resize", adjustHeight);

    const cleanup = () => {
        window.removeEventListener("resize", adjustHeight);
    };

    requestAnimationFrame(adjustHeight);

    wrapper.appendChild(editor);
    container.appendChild(wrapper);

    return cleanup;
}