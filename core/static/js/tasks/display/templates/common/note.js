/**
 * Рендерит заметку с поддержкой MathJax,
 * сохраняя переносы строк и ограничивая ширину контейнера.
 * Длинные формулы прокручиваются горизонтально отдельно.
 *
 * @param {Object} task
 * @param {HTMLElement} container
 */
export function renderNoteTask(task, container) {
    if (!container) return;

    container.innerHTML = "";

    const content =
        task?.data?.content && typeof task.data.content === "string"
            ? task.data.content
            : "";

    const noteWrapper = document.createElement("div");
    noteWrapper.style.whiteSpace = "pre-wrap";
    noteWrapper.style.wordBreak = "break-word";
    noteWrapper.style.maxWidth = "100%";
    noteWrapper.style.overflowX = "hidden";
    noteWrapper.style.overflowY = "auto";

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    const mathRegex = /(\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\])/g;
    let match;

    while ((match = mathRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            fragment.appendChild(
                document.createTextNode(content.substring(lastIndex, match.index))
            );
        }

        const formulaWrapper = document.createElement("div");
        formulaWrapper.style.display = "block";
        formulaWrapper.style.overflowX = "auto";
        formulaWrapper.style.overflowY = "hidden";
        formulaWrapper.style.whiteSpace = "nowrap";
        formulaWrapper.style.maxWidth = "100%";
        formulaWrapper.style.margin = "0.2em 0";

        const formulaSpan = document.createElement("span");
        formulaSpan.textContent = match[0];
        formulaWrapper.appendChild(formulaSpan);

        fragment.appendChild(formulaWrapper);
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
        fragment.appendChild(document.createTextNode(content.substring(lastIndex)));
    }

    noteWrapper.appendChild(fragment);
    container.appendChild(noteWrapper);

    if (!window.MathJax) {
        const script = document.createElement("script");
        script.type = "text/javascript";
        script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
        script.async = true;
        script.onload = () => {
            MathJax.typesetPromise([noteWrapper]).catch((err) =>
                console.error("MathJax render error:", err)
            );
        };
        document.head.appendChild(script);
    } else if (window.MathJax.typesetPromise) {
        MathJax.typesetPromise([noteWrapper]).catch((err) =>
            console.error("MathJax render error:", err)
        );
    }
}
