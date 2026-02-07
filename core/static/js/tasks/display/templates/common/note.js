import { formatLatex } from '/static/js/tasks/utils.js';

export function renderNoteTask(task, container) {
    if (!container) return;

    container.innerHTML = "";

    const content = task?.data?.content && typeof task.data.content === "string" ? task.data.content : "";

    const noteWrapper = document.createElement("div");
    noteWrapper.className = "note-task-content";
    noteWrapper.style.whiteSpace = "normal";
    noteWrapper.style.wordBreak = "break-word";
    noteWrapper.style.maxWidth = "100%";
    noteWrapper.style.backgroundColor = "#f8f9fa";
    noteWrapper.style.padding = "1rem";
    noteWrapper.style.borderRadius = "0.375rem";
    noteWrapper.style.lineHeight = "1.6";

    const renderContent = () => {
        noteWrapper.innerHTML = content;

        const latexElements = noteWrapper.querySelectorAll('span.latex-formula, [class*="latex"], [class*="math"]');
        latexElements.forEach(el => {
            const latexContent = el.textContent || '';
            if (latexContent.includes('$') || latexContent.includes('\\[')) {
                const fragment = formatLatex(latexContent);
                el.replaceWith(fragment);
            }
        });

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
            if (window.MathJax && window.MathJax.typesetPromise) {
                MathJax.typesetPromise([noteWrapper]).catch(err => console.error("MathJax render error:", err));
            }
        }, 250);
    };

    window.addEventListener("resize", onResize);
}