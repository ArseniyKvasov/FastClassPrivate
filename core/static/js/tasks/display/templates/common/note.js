import { formatLatex } from '/static/js/tasks/utils.js';

export function renderNoteTask(task, container) {
    if (!container) return;

    container.innerHTML = "";

    const content = task?.data?.content && typeof task.data.content === "string" ? task.data.content : "";

    const noteWrapper = document.createElement("div");
    noteWrapper.style.whiteSpace = "pre-wrap";
    noteWrapper.style.wordBreak = "break-word";
    noteWrapper.style.maxWidth = "100%";
    noteWrapper.style.backgroundColor = "#f8f9fa";
    noteWrapper.style.padding = "0.5rem";
    noteWrapper.style.borderRadius = "0.25rem";
    noteWrapper.style.lineHeight = "1.5";

    const renderContent = () => {
        noteWrapper.innerHTML = "";
        const fragment = formatLatex(content);
        noteWrapper.appendChild(fragment);

        if (window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetPromise([noteWrapper]).catch(err => console.error("MathJax render error:", err));
        }
    };

    renderContent();
    container.appendChild(noteWrapper);

    let resizeTimeout;
    const onResize = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            renderContent();
        }, 250);
    };

    window.addEventListener("resize", onResize);
}