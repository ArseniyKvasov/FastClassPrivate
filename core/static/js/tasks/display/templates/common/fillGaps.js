import { formatLatex } from '/static/js/tasks/editor/textFormatting.js';

export function renderFillGapsTask(task, container) {
    if (!container) return;
    container.innerHTML = "";

    const card = document.createElement("div");
    card.className = "rounded-4 mb-3";
    const cardBody = document.createElement("div");

    if (task.data.title) {
        const title = document.createElement("h6");
        title.className = "mb-3 fw-semibold text-primary";
        title.textContent = task.data.title;
        cardBody.appendChild(title);
    }

    if (task.data.list_type === "open" && Array.isArray(task.data.answers) && task.data.answers.length) {
        const hintBlock = document.createElement("div");
        hintBlock.className = "mb-3";

        const list = document.createElement("div");
        list.className = "d-flex flex-wrap gap-2";

        task.data.answers.forEach(answer => {
            const badge = document.createElement("span");
            badge.className = "badge bg-primary me-1 mb-1";
            badge.textContent = answer;

            list.appendChild(badge);
        });

        hintBlock.appendChild(list);
        cardBody.appendChild(hintBlock);
    }

    const textDiv = document.createElement("div");
    textDiv.className = "fill-gaps-text";
    textDiv.style.whiteSpace = "pre-wrap";
    textDiv.style.wordWrap = "break-word";

    textDiv.classList.add("text-break", "overflow-wrap-break-word", "word-break-break-word");

    const updateInputWidth = (input) => {
        const value = input.value.trim();
        if (!value) {
            input.style.width = "90px";
            return;
        }

        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'pre';
        tempSpan.style.font = window.getComputedStyle(input).font;
        tempSpan.style.left = '-9999px';
        tempSpan.textContent = value;

        document.body.appendChild(tempSpan);
        const measuredWidth = tempSpan.offsetWidth + 30;
        document.body.removeChild(tempSpan);

        const maxWidth = container.clientWidth * 0.6;
        const width = Math.min(Math.max(90, measuredWidth), maxWidth);

        input.style.width = `${width}px`;
    };

    const createInput = (index) => {
        const input = document.createElement("input");
        input.type = "text";
        input.id = `gap-${index}`;
        input.className = "form-control d-inline-block gap-input m-1";
        input.style.minWidth = "90px";
        input.style.width = "90px";
        input.style.height = "34px";
        input.style.maxWidth = "100%";
        input.setAttribute("autocomplete", "off");
        input.setAttribute("autocapitalize", "off");
        input.setAttribute("autocorrect", "off");
        input.setAttribute("spellcheck", "false");
        input.name = `field_${index}_${Math.random().toString(36).substr(2, 9)}`;


        input.addEventListener('input', () => {
            updateInputWidth(input);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });

        updateInputWidth(input);
        return input;
    };

    // Берем HTML напрямую из task.data.text
    const htmlText = task.data.text || "";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlText;

    const processNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            const parts = text.split(/(\[[^\]]+\])/g);

            if (parts.length > 1) {
                const fragment = document.createDocumentFragment();
                let inputIndex = 0;

                parts.forEach(part => {
                    if (part.startsWith('[') && part.endsWith(']')) {
                        fragment.appendChild(createInput(inputIndex++));
                    } else if (part) {
                        const lines = part.split('\n');
                        lines.forEach((line, index) => {
                            if (line.trim()) {
                                fragment.appendChild(document.createTextNode(line));
                            }
                            if (index < lines.length - 1) {
                                fragment.appendChild(document.createElement('br'));
                            }
                        });
                    }
                });

                return fragment;
            }

            const lines = text.split('\n');
            if (lines.length > 1) {
                const fragment = document.createDocumentFragment();
                lines.forEach((line, index) => {
                    if (line.trim() || line === '') {
                        fragment.appendChild(document.createTextNode(line));
                    }
                    if (index < lines.length - 1) {
                        fragment.appendChild(document.createElement('br'));
                    }
                });
                return fragment;
            }
            return node.cloneNode(true);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            let processedNode;

            if (tagName === 'p') {
                processedNode = document.createElement('div');
                processedNode.style.marginBottom = '0.5rem';
                processedNode.style.minHeight = '1.2em';
            } else if (tagName === 'br') {
                return document.createElement('br');
            } else if (tagName === 'strong' || tagName === 'b') {
                processedNode = document.createElement('strong');
            } else if (tagName === 'em' || tagName === 'i') {
                processedNode = document.createElement('em');
            } else if (tagName === 'u') {
                processedNode = document.createElement('span');
                processedNode.style.textDecoration = 'underline';
            } else {
                processedNode = node.cloneNode(false);
            }

            for (const child of node.childNodes) {
                const processedChild = processNode(child);
                if (processedChild) {
                    processedNode.appendChild(processedChild);
                }
            }

            return processedNode;
        }

        return node.cloneNode(true);
    };

    const processedContent = processNode(tempDiv);

    if (processedContent.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        while (processedContent.firstChild) {
            textDiv.appendChild(processedContent.firstChild);
        }
    } else {
        textDiv.appendChild(processedContent);
    }

    cardBody.appendChild(textDiv);
    card.appendChild(cardBody);
    container.appendChild(card);

    const renderMathJax = () => {
        if (window.MathJax && window.MathJax.typesetPromise) {
            MathJax.typesetPromise([textDiv]).catch(err => console.error("MathJax render error:", err));
        }
    };

    const handleResize = () => {
        textDiv.querySelectorAll('.gap-input').forEach(input => {
            updateInputWidth(input);
        });
        renderMathJax();
    };

    window.addEventListener('resize', handleResize);

    setTimeout(() => {
        textDiv.querySelectorAll('.gap-input').forEach(input => {
            updateInputWidth(input);
        });
        renderMathJax();
    }, 100);

    const observer = new MutationObserver(() => {
        if (!container.contains(card)) {
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
        }
    });
    observer.observe(container, { childList: true, subtree: true });
}