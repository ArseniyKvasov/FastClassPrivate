export function createRichTextEditor(initialHTML = "") {
    const allowedTags = new Set(["STRONG", "B", "I", "U", "UL", "OL", "LI", "DIV", "P", "BR", "SPAN"]);

    function decodeHTMLEntities(text) {
        const textarea = document.createElement("textarea");
        textarea.innerHTML = text;
        return textarea.value;
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
    toolbar.className = "btn-toolbar gap-1 mb-2";

    const buttons = [
        { label: "B", cmd: "bold" },
        { label: "I", cmd: "italic" },
        { label: "U", cmd: "underline" },
        { label: "•", cmd: "insertUnorderedList" },
        { label: "1.", cmd: "insertOrderedList" },
    ];

    buttons.forEach(({ label, cmd }) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-sm btn-outline-secondary";
        btn.innerHTML = label;

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
    editor.innerHTML = sanitizeHTMLString(initialHTML);

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
            let cleanedText = text
                .replace(/\*/g, "")
                .replace(/\#/g, "")
                .replace(/\—/g, "-");
            document.execCommand("insertText", false, cleanedText);
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

        const formulaSpan = document.createElement("span");
        formulaSpan.className = "latex-formula";
        formulaSpan.style.display = "inline-block";
        formulaSpan.textContent = match[0];
        fragment.appendChild(formulaSpan);

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