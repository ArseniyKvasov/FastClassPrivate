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

    // Добавляем Bootstrap классы для переноса текста
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
        const measuredWidth = tempSpan.offsetWidth + 20;
        document.body.removeChild(tempSpan);

        // Максимальная ширина = 60% от ширины контейнера
        const maxWidth = container.clientWidth * 0.6;
        const width = Math.min(Math.max(90, measuredWidth), maxWidth);

        input.style.width = `${width}px`;
    };

    const createInput = (index) => {
        const input = document.createElement("input");
        input.type = "text";
        input.id = `gap-${index}`;
        input.className = "form-control d-inline-block gap-input mx-1";
        input.style.minWidth = "90px";
        input.style.width = "90px";
        input.style.height = "34px";
        input.style.maxWidth = "100%";

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
                        fragment.appendChild(document.createTextNode(part));
                    }
                });

                return fragment;
            }
            return node.cloneNode(true);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const processedNode = node.cloneNode(false);

            // Добавляем классы для переноса к элементам
            if (['p', 'div', 'span'].includes(processedNode.tagName.toLowerCase())) {
                processedNode.classList.add("text-break", "overflow-wrap-break-word");
            }

            for (const child of node.childNodes) {
                const processedChild = processNode(child);
                if (processedChild) {
                    if (processedChild.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                        processedNode.appendChild(processedChild);
                    } else {
                        processedNode.appendChild(processedChild);
                    }
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

    const handleResize = () => {
        textDiv.querySelectorAll('.gap-input').forEach(input => {
            updateInputWidth(input);
        });
    };

    window.addEventListener('resize', handleResize);

    setTimeout(() => {
        textDiv.querySelectorAll('.gap-input').forEach(input => {
            updateInputWidth(input);
        });
    }, 100);

    const observer = new MutationObserver(() => {
        if (!container.contains(card)) {
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
        }
    });
    observer.observe(container, { childList: true, subtree: true });
}