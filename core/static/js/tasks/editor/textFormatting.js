export function createRichTextEditor(initialHTML = "") {
    const allowedTags = new Set([
        "STRONG",
        "B",
        "I",
        "U",
        "UL",
        "OL",
        "LI",
        "DIV",
        "P",
        "BR",
        "SPAN"
    ]);

    function decodeHTMLEntities(html) {
        const textarea = document.createElement("textarea");
        textarea.innerHTML = html;
        return textarea.value;
    }

    function sanitizeInPlace(root) {
        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_ELEMENT,
            null
        );

        const unwrap = [];

        while (walker.nextNode()) {
            const node = walker.currentNode;

            if (!allowedTags.has(node.tagName)) {
                unwrap.push(node);
                continue;
            }

            for (let i = node.attributes.length - 1; i >= 0; i--) {
                node.removeAttribute(node.attributes[i].name);
            }
        }

        unwrap.forEach(node => {
            const parent = node.parentNode;
            if (!parent) return;

            while (node.firstChild) {
                parent.insertBefore(node.firstChild, node);
            }
            parent.removeChild(node);
        });
    }

    function sanitizeHTMLString(html) {
        const decoded = decodeHTMLEntities(html);
        const container = document.createElement("div");
        container.innerHTML = decoded;
        sanitizeInPlace(container);
        return container.innerHTML;
    }

    function markdownToHTML(text) {
        let result = text;

        result = result.replace(/^#{1,6}\s*(.+)$/gm, "<strong><u>$1</u></strong>");

        result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        result = result.replace(/__(.+?)__/g, "<u>$1</u>");
        result = result.replace(/\*(.+?)\*/g, "<i>$1</i>");
        result = result.replace(/_(.+?)_/g, "<i>$1</i>");

        result = result.replace(/\n/g, "<br>");

        result = result.replace(/[—–]/g, "-");

        return result;
    }

    function exec(command) {
        document.execCommand(command, false, null);
        sanitizeInPlace(editor);
    }

    const toolbar = document.createElement("div");
    toolbar.className = "btn-toolbar gap-2 mb-1";

    [
        { icon: "bi bi-type-bold", cmd: "bold" },
        { icon: "bi bi-type-italic", cmd: "italic" },
        { icon: "bi bi-type-underline", cmd: "underline" },
        { icon: "bi bi-list-ul", cmd: "insertUnorderedList" },
        { icon: "bi bi-list-ol", cmd: "insertOrderedList" }
    ].forEach(({ icon, cmd }) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-light btn-sm border";
        btn.innerHTML = `<i class="${icon}"></i>`;

        btn.addEventListener("mousedown", e => e.preventDefault());
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

    editor.innerHTML = sanitizeHTMLString(initialHTML);

    function updateHeight() {
        editor.style.height = "auto";
        const h = Math.min(400, Math.max(120, editor.scrollHeight));
        editor.style.height = h + "px";
        editor.style.overflowY = editor.scrollHeight > 400 ? "auto" : "hidden";
    }

    new MutationObserver(() => {
        updateHeight();
    }).observe(editor, {
        childList: true,
        subtree: true,
        characterData: true
    });

    editor.addEventListener("input", () => {
        updateHeight();
    });

    editor.addEventListener("keydown", e => {
        if (!e.ctrlKey && !e.metaKey) return;

        if (e.key === "b") {
            e.preventDefault();
            exec("bold");
        }

        if (e.key === "i") {
            e.preventDefault();
            exec("italic");
        }

        if (e.key === "u") {
            e.preventDefault();
            exec("underline");
        }
    });

    editor.addEventListener("paste", e => {
        e.preventDefault();

        const data = e.clipboardData || window.clipboardData;
        const html = data.getData("text/html");
        const text = data.getData("text/plain");

        if (html) {
            const sanitized = sanitizeHTMLString(html);
            document.execCommand("insertHTML", false, sanitized);
            return;
        }

        const markdownHTML = markdownToHTML(text);
        const sanitized = sanitizeHTMLString(markdownHTML);
        document.execCommand("insertHTML", false, sanitized);
    });

    editor.addEventListener("blur", () => {
        sanitizeInPlace(editor);
    });

    updateHeight();

    return {
        editor,
        toolbar,
        getHTML() {
            return sanitizeHTMLString(editor.innerHTML);
        },
        setHTML(html) {
            editor.innerHTML = sanitizeHTMLString(html);
            updateHeight();
        }
    };
}

export function formatLatex(content) {
    if (!content) {
        return document.createDocumentFragment();
    }

    let wrapper = document.createElement("div");
    wrapper.innerHTML = content;

    const fragment = document.createDocumentFragment();
    fragment.appendChild(wrapper);

    const typesetMath = () => {
        if (window.MathJax && MathJax.typesetPromise) {
            MathJax.typesetPromise([wrapper]).catch(() => {});
        }
    };

    typesetMath();

    let resizeTimeout = null;

    const onResize = () => {
        clearTimeout(resizeTimeout);

        resizeTimeout = setTimeout(() => {
            const parent = wrapper.parentNode;
            if (!parent) return;

            const newWrapper = document.createElement("div");
            newWrapper.innerHTML = content;

            parent.replaceChild(newWrapper, wrapper);
            wrapper = newWrapper;

            typesetMath();
        }, 200);
    };

    window.addEventListener("resize", onResize);

    return fragment;
}
