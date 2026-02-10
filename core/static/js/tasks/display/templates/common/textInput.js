import { escapeHtml } from "js/tasks/utils.js";
import { createRichTextEditor } from "js/tasks/editor/textFormatting.js";

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

    const { editor, toolbar, getHTML, setHTML } = createRichTextEditor(task.data.default_text || "");

    editor.classList.add("form-control");
    editor.style.resize = "none";
    editor.style.overflowY = "auto";
    editor.style.minHeight = "120px";

    wrapper.appendChild(toolbar);
    wrapper.appendChild(editor);

    container.appendChild(wrapper);
}