export function createRichTextEditor(initialHTML = "") {
    const allowedTags = new Set(["STRONG", "B", "I", "U", "UL", "OL", "LI", "DIV", "P", "BR", "SPAN"]);

    function decodeHTMLEntities(text) {
        const textarea = document.createElement("textarea");
        textarea.innerHTML = text;
        return textarea.value;
    }

    function preprocessText(text) {
        const lines = text.split('\n');
        let inLatexBlock = false;
        let latexBuffer = [];
        let processedLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('\\[')) {
                inLatexBlock = true;
                latexBuffer.push(line);
            } else if (line.endsWith('\\]')) {
                latexBuffer.push(line);
                processedLines.push(latexBuffer.join(' '));
                inLatexBlock = false;
                latexBuffer = [];
            } else if (inLatexBlock) {
                latexBuffer.push(line);
            } else {
                processedLines.push(lines[i]);
            }
        }

        if (latexBuffer.length > 0) {
            processedLines.push(latexBuffer.join(' '));
        }

        return processedLines.join('\n');
    }

    function markdownToHTML(text) {
        return text
            .replace(/^###### (.*$)/gim, '<p>$1</p>')
            .replace(/^##### (.*$)/gim, '<p>$1</p>')
            .replace(/^#### (.*$)/gim, '<p>$1</p>')
            .replace(/^### (.*$)/gim, '<p>$1</p>')
            .replace(/^## (.*$)/gim, '<p>$1</p>')
            .replace(/^# (.*$)/gim, '<p>$1</p>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/^- (.*$)/gim, '<li>$1</li>')
            .replace(/^\d\. (.*$)/gim, '<li>$1</li>')
            .replace(/<li>.*<\/li>/gim, (match) => {
                const lines = match.split('\n').filter(l => l.includes('<li>'));
                return `<ul>${lines.join('')}</ul>`;
            })
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            .replace(/\n/g, '<br>');
    }

    function sanitizeInPlace(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
        const toUnwrap = [];

        while (walker.nextNode()) {
            const node = walker.currentNode;

            if (!allowedTags.has(node.tagName)) {
                toUnwrap.push(node);
                continue;
            }

            for (let i = node.attributes.length - 1; i >= 0; i--) {
                node.removeAttribute(node.attributes[i].name);
            }
        }

        toUnwrap.forEach(node => {
            const parent = node.parentNode;
            if (!parent) return;
            while (node.firstChild) {
                parent.insertBefore(node.firstChild, node);
            }
            parent.removeChild(node);
        });
    }

    function sanitizeHTMLString(html) {
        const cleanedText = html
                .replace(/\*/g, "")
                .replace(/\#/g, "")
                .replace(/\—/g, "-");
        const decodedHTML = decodeHTMLEntities(html);
        const container = document.createElement("div");
        container.innerHTML = decodedHTML;

        const walker = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, null);
        const toUnwrap = [];

        while (walker.nextNode()) {
            const node = walker.currentNode;
            if (!allowedTags.has(node.tagName)) {
                toUnwrap.push(node);
                continue;
            }
            for (let i = node.attributes.length - 1; i >= 0; i--) {
                node.removeAttribute(node.attributes[i].name);
            }
        }

        toUnwrap.forEach(node => {
            const parent = node.parentNode;
            if (!parent) return;
            while (node.firstChild) {
                parent.insertBefore(node.firstChild, node);
            }
            parent.removeChild(node);
        });

        return container.innerHTML;
    }

    function exec(command) {
        document.execCommand(command, false, null);
        sanitizeInPlace(editor);
    }

    const toolbar = document.createElement("div");
    toolbar.className = "btn-toolbar gap-2 mb-1";

    const buttons = [
        { icon: "bi bi-type-bold", cmd: "bold", title: "Жирный" },
        { icon: "bi bi-type-italic", cmd: "italic", title: "Курсив" },
        { icon: "bi bi-type-underline", cmd: "underline", title: "Подчеркнутый" },
        { icon: "bi bi-list-ul", cmd: "insertUnorderedList", title: "Маркированный список" },
        { icon: "bi bi-list-ol", cmd: "insertOrderedList", title: "Нумерованный список" },
    ];

    buttons.forEach(({ icon, cmd, title }) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-light btn-sm border";
        btn.innerHTML = `<i class="${icon}"></i>`;
        btn.title = title;

        btn.addEventListener("mousedown", (e) => {
            e.preventDefault();
        });

        btn.addEventListener("click", () => {
            exec(cmd);
            editor.focus();
        });

        toolbar.appendChild(btn);
    });

    const editor = document.createElement("div");
    editor.className = "form-control rich-text-editor-area";
    editor.contentEditable = "true";
    editor.style.minHeight = "120px";
    editor.style.overflow = "hidden";
    editor.style.resize = "none";
    editor.innerHTML = sanitizeHTMLString(initialHTML);

    function updateEditorHeight() {
        editor.style.height = "auto";
        const newHeight = Math.max(120, Math.min(400, editor.scrollHeight));
        editor.style.height = newHeight + "px";
        editor.style.overflowY = editor.scrollHeight > 400 ? "auto" : "hidden";
    }

    const observer = new MutationObserver(updateEditorHeight);
    observer.observe(editor, {
        childList: true,
        subtree: true,
        characterData: true
    });

    editor.addEventListener("input", updateEditorHeight);
    editor.addEventListener("keydown", updateEditorHeight);
    editor.addEventListener("paste", updateEditorHeight);
    editor.addEventListener("cut", updateEditorHeight);

    editor.addEventListener("keydown", (event) => {
        if (!event.ctrlKey && !event.metaKey) return;

        switch (event.key.toLowerCase()) {
            case "b":
                event.preventDefault();
                exec("bold");
                break;
            case "i":
                event.preventDefault();
                exec("italic");
                break;
            case "u":
                event.preventDefault();
                exec("underline");
                break;
        }
    });

    editor.addEventListener("paste", (event) => {
        event.preventDefault();

        const clipboardData = event.clipboardData || window.clipboardData;
        let html = clipboardData.getData("text/html");
        const text = clipboardData.getData("text/plain");

        if (html) {
            const sanitizedHTML = sanitizeHTMLString(html);
            document.execCommand("insertHTML", false, sanitizedHTML);
        } else {
            let cleanedText = text.replace(/\—/g, "-");

            cleanedText = preprocessText(cleanedText);

            const hasMarkdown = /(\*\*|__|\*|_|^[#\-*] |\[.*\]\(.*\))/.test(cleanedText);

            if (hasMarkdown) {
                const htmlContent = markdownToHTML(cleanedText);
                const sanitizedHTML = sanitizeHTMLString(htmlContent);
                document.execCommand("insertHTML", false, sanitizedHTML);
            } else {
                document.execCommand("insertText", false, cleanedText);
            }
        }
    });

    editor.addEventListener("blur", () => {
        sanitizeInPlace(editor);
    });

    return {
        editor,
        toolbar,
        getHTML() {
            return sanitizeHTMLString(editor.innerHTML);
        },
        setHTML(html) {
            editor.innerHTML = sanitizeHTMLString(html);
            updateEditorHeight();
        },
    };
}

export function formatLatex(content) {
    if (!content) {
        const fragment = document.createDocumentFragment();
        return fragment;
    }

    const mathRegex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$]+\$)/g;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    const processHtmlSegment = (html) => {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div;
    };

    const plainText = content;

    while ((match = mathRegex.exec(plainText)) !== null) {
        if (match.index > lastIndex) {
            const htmlBefore = plainText.substring(lastIndex, match.index);
            if (htmlBefore.trim()) {
                const segment = processHtmlSegment(htmlBefore);
                while (segment.firstChild) {
                    fragment.appendChild(segment.firstChild);
                }
            }
        }

        const formulaWrapper = document.createElement("div");
        formulaWrapper.style.display = "block";
        formulaWrapper.style.overflowX = "auto";
        formulaWrapper.style.whiteSpace = "nowrap";
        formulaWrapper.style.maxWidth = "100%";
        formulaWrapper.style.margin = "0.5em 0";
        formulaWrapper.style.lineHeight = "1.8";
        formulaWrapper.style.padding = "0.3em 0";

        const formulaSpan = document.createElement("span");
        formulaSpan.className = "latex-formula";
        formulaSpan.textContent = match[0];
        formulaSpan.style.fontSize = "1em";
        formulaSpan.style.verticalAlign = "middle";

        formulaWrapper.appendChild(formulaSpan);
        fragment.appendChild(formulaWrapper);

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < plainText.length) {
        const remainingHtml = plainText.substring(lastIndex);
        if (remainingHtml.trim()) {
            const segment = processHtmlSegment(remainingHtml);
            while (segment.firstChild) {
                fragment.appendChild(segment.firstChild);
            }
        }
    }

    const hasMath = mathRegex.test(plainText);
    mathRegex.lastIndex = 0;

    if (!hasMath) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = content;
        while (wrapper.firstChild) {
            fragment.appendChild(wrapper.firstChild);
        }
    }

    return fragment;
}