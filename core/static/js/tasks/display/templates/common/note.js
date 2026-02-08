import { formatLatex } from "/static/js/tasks/editor/textFormatting.js";

export function renderNoteTask(task, container) {
    if (!container) return;

    container.innerHTML = "";

    const content =
        task?.data?.content && typeof task.data.content === "string"
            ? task.data.content
            : "";

    const noteWrapper = document.createElement("div");
    noteWrapper.className = "note-task-content";
    noteWrapper.style.whiteSpace = "normal";
    noteWrapper.style.wordBreak = "break-word";
    noteWrapper.style.maxWidth = "100%";
    noteWrapper.style.backgroundColor = "#f8f9fa";
    noteWrapper.style.padding = "1rem";
    noteWrapper.style.borderRadius = "0.375rem";

    const fragment = formatLatex(content);

    noteWrapper.appendChild(fragment);
    container.appendChild(noteWrapper);
}
