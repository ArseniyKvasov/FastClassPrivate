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

        return result;
    }

    function replaceLongDashes(text) {
        return text.replace(/[—–]/g, "-");
    }

    function exec(command) {
        document.execCommand(command, false, null);
        sanitizeInPlace(editor);
    }

    function clearFormatting() {
        document.execCommand("removeFormat", false, null);
        document.execCommand("unlink", false, null);
        sanitizeInPlace(editor);
    }

    function getCaretOffsetWithin(container) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        const range = sel.getRangeAt(0).cloneRange();
        range.selectNodeContents(container);
        range.setEnd(sel.anchorNode, sel.anchorOffset);
        return range.toString().length;
    }

    function isCaretInsideMath(container) {
        const offset = getCaretOffsetWithin(container);
        if (offset === null) return false;
        const text = container.textContent || "";
        let start = -1;
        while (true) {
            const i = text.indexOf("$$", start + 1);
            if (i === -1) break;
            const j = text.indexOf("$$", i + 2);
            if (j === -1) break;
            if (i < offset && offset < j) return true;
            start = j;
        }
        return false;
    }

    function processTextForPaste(text, insideMath) {
        const textWithDashes = replaceLongDashes(text);

        if (insideMath) {
            return textWithDashes.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, (m, inner) => {
                const collapsed = inner.replace(/\r?\n/g, "");
                return "$$" + collapsed + "$$";
            });
        }

        const parts = textWithDashes.split(/(\$\$[\s\S]*?\$\$)/g);
        return parts.map(part => {
            if (/^\$\$[\s\S]*\$\$$/.test(part)) {
                const inner = part.slice(2, -2).replace(/\r?\n/g, "");
                return "$$" + inner + "$$";
            }

            let normalizedPart = part;
            return markdownToHTML(normalizedPart);
        }).join("");
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

    const eraserBtn = document.createElement("button");
    eraserBtn.type = "button";
    eraserBtn.className = "btn btn-light btn-sm border";
    eraserBtn.innerHTML = `<i class="bi bi-eraser"></i>`;
    eraserBtn.addEventListener("mousedown", e => e.preventDefault());
    eraserBtn.addEventListener("click", () => {
        clearFormatting();
        editor.focus();
    });
    toolbar.appendChild(eraserBtn);

    const editor = document.createElement("div");
    editor.className = "form-control rich-text-editor-area";
    editor.contentEditable = "true";
    editor.style.minHeight = "200px";
    editor.style.overflowY = "scroll";

    editor.innerHTML = sanitizeHTMLString(replaceLongDashes(initialHTML));

    function updateHeight() {
        editor.style.height = "auto";
        const h = Math.min(400, Math.max(200, editor.scrollHeight));
        editor.style.height = h + "px";
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
        const insideMath = isCaretInsideMath(editor);

        if (html && !insideMath) {
            const sanitized = sanitizeHTMLString(replaceLongDashes(html));
            document.execCommand("insertHTML", false, sanitized);
            sanitizeInPlace(editor);
            return;
        }

        const processed = processTextForPaste(text || html || "", insideMath);
        if (insideMath) {
            document.execCommand("insertText", false, processed);
        } else {
            const sanitized = sanitizeHTMLString(processed);
            document.execCommand("insertHTML", false, sanitized);
        }
        sanitizeInPlace(editor);
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
            editor.innerHTML = sanitizeHTMLString(replaceLongDashes(html));
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

    const isMathElement = (el) => {
        return el.matches('.MathJax, .math, [class*="math"], mjx-container, .MathJax_Display') ||
               el.matches('.math-inline, [class*="math-inline"]') ||
               (el.closest && el.closest('.MathJax, .math, [class*="math"], mjx-container'));
    };

    const isInlineContext = (el) => {
        const parent = el.parentNode;
        if (!parent) return false;

        const parentText = parent.textContent || '';
        const elIndex = Array.from(parent.childNodes).indexOf(el);
        const prevSibling = parent.childNodes[elIndex - 1];
        const nextSibling = parent.childNodes[elIndex + 1];

        const hasPrevText = prevSibling && prevSibling.nodeType === Node.TEXT_NODE && prevSibling.textContent.trim().length > 0;
        const hasNextText = nextSibling && nextSibling.nodeType === Node.TEXT_NODE && nextSibling.textContent.trim().length > 0;

        return hasPrevText || hasNextText || parentText.trim().length < 50;
    };

    const wrapMathElements = (node) => {
        const mathElements = node.querySelectorAll('.MathJax, .math, [class*="math"], mjx-container, .MathJax_Display');
        mathElements.forEach(el => {
            if (el.parentNode && !el.parentNode.classList.contains('math-wrapper')) {
                const isInline = isInlineContext(el) && !el.classList.contains('MathJax_Display');

                const mathWrapper = document.createElement('span');
                mathWrapper.className = 'math-wrapper';

                if (isInline) {
                    mathWrapper.style.overflowX = 'auto';
                    mathWrapper.style.overflowY = 'hidden';
                    mathWrapper.style.maxWidth = '100%';
                    mathWrapper.style.display = 'inline-block';
                    mathWrapper.style.verticalAlign = 'middle';
                } else {
                    mathWrapper.style.overflowX = 'auto';
                    mathWrapper.style.overflowY = 'hidden';
                    mathWrapper.style.maxWidth = '100%';
                    mathWrapper.style.display = 'block';
                }

                el.parentNode.insertBefore(mathWrapper, el);
                mathWrapper.appendChild(el);
            }
        });
    };

    wrapMathElements(wrapper);

    const processLinks = (node) => {
        const walker = document.createTreeWalker(
            node,
            NodeFilter.SHOW_TEXT,
            null
        );

        const textNodes = [];
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            const parent = textNode.parentNode;

            if (parent.closest('.MathJax, .math, [class*="math"], mjx-container, .math-wrapper')) {
                return;
            }

            const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
            let lastIndex = 0;
            const parts = [];
            let match;

            while ((match = urlRegex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    parts.push(document.createTextNode(text.substring(lastIndex, match.index)));
                }

                const link = document.createElement('a');
                link.href = match[0];
                link.textContent = match[0];
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                parts.push(link);

                lastIndex = match.index + match[0].length;
            }

            if (parts.length === 0) return;

            if (lastIndex < text.length) {
                parts.push(document.createTextNode(text.substring(lastIndex)));
            }

            const fragment = document.createDocumentFragment();
            parts.forEach(part => fragment.appendChild(part));
            parent.replaceChild(fragment, textNode);
        });
    };

    processLinks(wrapper);

    const fragment = document.createDocumentFragment();
    fragment.appendChild(wrapper);

    const typesetMath = () => {
        if (window.MathJax && MathJax.typesetPromise) {
            MathJax.typesetPromise([wrapper]).then(() => {
                wrapMathElements(wrapper);
            }).catch(() => {});
        }
    };

    typesetMath();

    return fragment;
}