/**
 * Рендерит заметку с поддержкой MathJax v4,
 * сохраняя переносы строк и добавляя горизонтальный скролл для длинных формул.
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

    // Разделяем контент на блоки по формуле $$...$$ или \[...\]
    const mathRegex = /(\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\])/g;
    let lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let match;

    while ((match = mathRegex.exec(content)) !== null) {
        // Вставляем обычный текст до формулы
        if (match.index > lastIndex) {
            fragment.appendChild(
                document.createTextNode(content.substring(lastIndex, match.index))
            );
        }

        // Контейнер для формулы с горизонтальным скроллом
        const formulaWrapper = document.createElement("div");
        formulaWrapper.style.display = "block";
        formulaWrapper.style.overflowX = "auto";
        formulaWrapper.style.whiteSpace = "nowrap";
        formulaWrapper.style.maxWidth = "100%";
        formulaWrapper.style.margin = "0.2em 0";

        const formulaSpan = document.createElement("span");
        formulaSpan.textContent = match[0]; // вставляем сырой текст формулы
        formulaWrapper.appendChild(formulaSpan);

        fragment.appendChild(formulaWrapper);
        lastIndex = match.index + match[0].length;
    }

    // Вставляем оставшийся текст
    if (lastIndex < content.length) {
        fragment.appendChild(document.createTextNode(content.substring(lastIndex)));
    }

    noteWrapper.appendChild(fragment);
    container.appendChild(noteWrapper);

    // Подключаем MathJax v4
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
        script.onload = () => {
            MathJax.typesetPromise([noteWrapper]).catch(err =>
                console.error("MathJax render error:", err)
            );
        };
        document.head.appendChild(script);
    } else if (window.MathJax.typesetPromise) {
        MathJax.typesetPromise([noteWrapper]).catch(err =>
            console.error("MathJax render error:", err)
        );
    }
}