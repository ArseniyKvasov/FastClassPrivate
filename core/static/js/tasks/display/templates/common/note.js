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
    noteWrapper.style.backgroundColor = "#f8f9fa";
    noteWrapper.style.padding = "0.5rem";
    noteWrapper.style.borderRadius = "0.25rem";

    const mathRegex = /(\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\])/g;

    const escapeHtml = (str) =>
        str.replace(/&/g, "&amp;")
           .replace(/</g, "&lt;")
           .replace(/>/g, "&gt;");

    const parseMarkdown = (text) => {
        let html = escapeHtml(text);
        html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
        html = html.replace(/__(.+?)__/g, "<u>$1</u>");
        html = html.replace(/^(?:- )(.*)$/gm, "<li>$1</li>");
        if (/<li>/.test(html)) html = html.replace(/(<li>[\s\S]+<\/li>)/g, "<ul>$1</ul>");
        html = html.replace(/^\d+\. (.*)$/gm, "<li>$1</li>");
        if (/<li>/.test(html) && !/<ul>/.test(html)) html = html.replace(/(<li>[\s\S]+<\/li>)/g, "<ol>$1</ol>");
        html = html.replace(/\n/g, "<br>");
        return html;
    };

    const renderContent = () => {
        noteWrapper.innerHTML = "";
        let lastIndex = 0;
        const fragment = document.createDocumentFragment();
        let match;

        while ((match = mathRegex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                const mdText = content.substring(lastIndex, match.index);
                const span = document.createElement("span");
                span.innerHTML = parseMarkdown(mdText);
                fragment.appendChild(span);
            }

            const formulaWrapper = document.createElement("div");
            formulaWrapper.style.display = "block";
            formulaWrapper.style.overflowX = "auto";
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
            const mdText = content.substring(lastIndex);
            const span = document.createElement("span");
            span.innerHTML = parseMarkdown(mdText);
            fragment.appendChild(span);
        }

        noteWrapper.appendChild(fragment);

        if (!window.MathJax) {
            window.MathJax = {
                tex: {
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$','$$'], ['\\[','\\]']],
                    packages: {'[+]': ['autoload']}
                },
                output: {
                    displayOverflow: 'linebreak',
                    linebreaks: { inline: true, width: '100%' }
                }
            };

            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/mathjax@4/tex-mml-chtml.js";
            script.defer = true;
            script.onload = () => MathJax.typesetPromise([noteWrapper]).catch(err =>
                console.error("MathJax render error:", err)
            );
            document.head.appendChild(script);
        } else if (window.MathJax.typesetPromise) {
            MathJax.typesetPromise([noteWrapper]).catch(err =>
                console.error("MathJax render error:", err)
            );
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
