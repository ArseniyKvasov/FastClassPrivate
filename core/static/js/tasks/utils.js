/**
 * Получает CSRF-токен из cookie
 * @returns {string} csrftoken
 */
export function getCsrfToken() {
    const name = "csrftoken=";
    const decoded = decodeURIComponent(document.cookie);
    const cookies = decoded.split(";");

    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(name)) {
            return cookie.substring(name.length);
        }
    }
    return "";
}

/**
 * Показывает уведомление в правом нижнем углу экрана
 * @param {string} text - Текст уведомления
 */
export function showNotification(text, seconds = 3) {
    let container = document.getElementById("notification-container");

    if (!container) {
        container = document.createElement("div");
        container.id = "notification-container";
        container.style.position = "fixed";
        container.style.left = "1rem";
        container.style.bottom = "1rem";
        container.style.display = "flex";
        container.style.flexDirection = "column-reverse";
        container.style.gap = "0.5rem";
        container.style.maxHeight = "60vh";
        container.style.overflowY = "auto";
        container.style.zIndex = "1080";
        container.style.width = "auto";
        container.style.maxWidth = "calc(100% - 2rem)";
        document.body.appendChild(container);
    }

    const existingToasts = container.querySelectorAll(".toast");
    if (existingToasts.length >= 3) {
        existingToasts[0].remove();
    }

    const toast = document.createElement("div");
    toast.className = "toast align-items-center text-white border-0 show p-2 rounded shadow-sm";
    toast.style.backgroundColor = "rgba(50, 50, 50, 0.9)";
    toast.style.minWidth = "220px";
    toast.style.width = "auto";
    toast.style.maxWidth = "100%";
    toast.style.wordBreak = "break-word";
    toast.style.fontSize = "0.875rem";
    toast.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
    toast.innerHTML = `
        <div class="d-flex align-items-center justify-content-between">
            <div class="toast-body">${text}</div>
            <button type="button" class="btn-close btn-close-white ms-2 p-1" aria-label="Close"></button>
        </div>
    `;

    toast.querySelector(".btn-close").addEventListener("click", () => toast.remove());

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = "opacity 0.4s, transform 0.4s";
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-20px)";
        toast.addEventListener("transitionend", () => toast.remove());
    }, seconds * 1000);
}

/**
 * Мини-функция для "debounce"
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Простейший fetch POST с CSRF
 * @param {string} url
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function postJSON(url, data) {
    const csrfToken = getCsrfToken();
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify(data),
    });
    return res.json();
}

/**
 * Показывает минималистичное окно подтверждения.
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export function confirmAction(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        Object.assign(overlay.style, {
            position: "fixed",
            inset: "0",
            backgroundColor: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: "1050",
        });

        const modal = document.createElement("div");
        modal.className = "bg-white rounded-3 shadow";
        Object.assign(modal.style, {
            padding: "20px 24px",
            minWidth: "280px",
            maxWidth: "90%",
            textAlign: "center",
        });

        const msg = document.createElement("div");
        msg.textContent = message;
        Object.assign(msg.style, {
            marginBottom: "16px",
            fontSize: "15px",
            color: "#212529",
        });

        const actions = document.createElement("div");
        Object.assign(actions.style, {
            display: "flex",
            justifyContent: "center",
            gap: "20px",
        });

        const btnConfirm = document.createElement("button");
        btnConfirm.type = "button";
        btnConfirm.textContent = "Да";
        Object.assign(btnConfirm.style, {
            background: "none",
            border: "none",
            padding: "4px 8px",
            color: "#0d6efd",
            fontWeight: "600",
            cursor: "pointer",
        });

        const btnCancel = document.createElement("button");
        btnCancel.type = "button";
        btnCancel.textContent = "Нет";
        Object.assign(btnCancel.style, {
            background: "none",
            border: "none",
            padding: "4px 8px",
            color: "#6c757d",
            fontWeight: "600",
            cursor: "pointer",
        });

        btnConfirm.addEventListener("click", () => {
            document.body.removeChild(overlay);
            resolve(true);
        });

        btnCancel.addEventListener("click", () => {
            document.body.removeChild(overlay);
            resolve(false);
        });

        actions.append(btnConfirm, btnCancel);
        modal.append(msg, actions);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    });
}

/**
 * Показывает в контейнере центрированный лоадер со спиннером и меняющимися фразами.
 *
 * Аргументы:
 * - container: HTMLElement - куда вставлять лоадер (у контейнера должен быть position: relative)
 * - phrases: string[] - список фраз, которые будут меняться каждые 5 секунд в случайном порядке
 *
 * Возвращает объект с методами:
 * - start() - запустить/перезапустить лоадер
 * - stop() - остановить и удалить лоадер
 * - showError(message, retryHandler) - показать ошибку с кнопкой "Попробовать снова" (retryHandler optional)
 */
export function showLoaderWithPhrases(container, phrases = []) {
    if (!container) return;

    let intervalId = null;
    let timeoutId = null;
    let phraseEl = null;
    let shuffleOrder = [];
    let pos = 0;
    let mounted = false;

    const loader = document.createElement("div");
    loader.className = "position-absolute top-50 start-50 translate-middle text-center";
    loader.style.pointerEvents = "auto";
    loader.innerHTML = `
        <div class="spinner-border text-primary" role="status" aria-hidden="true"></div>
        <div class="mt-2 loader-phrase" style="min-height:1.25rem;"></div>
    `;
    phraseEl = loader.querySelector(".loader-phrase");

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function nextPhrase() {
        if (!shuffleOrder.length) {
            phraseEl.textContent = "";
            return;
        }
        if (pos >= shuffleOrder.length) pos = 0;
        phraseEl.textContent = shuffleOrder[pos] || "";
        pos++;
    }

    function clearTimers() {
        if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
        }
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    }

    function startRotation() {
        clearTimers();
        shuffleOrder = shuffle(phrases || []);
        pos = 0;
        nextPhrase();
        intervalId = setInterval(nextPhrase, 5000);

        timeoutId = setTimeout(() => {
            if (mounted) {
                showError("Загрузка заняла слишком много времени", null);
            }
        }, 40000);
    }

    function mount() {
        if (!mounted) {
            container.appendChild(loader);
            mounted = true;
        }
    }

    function unmount() {
        clearTimers();
        if (mounted && loader.parentNode) {
            loader.parentNode.removeChild(loader);
        }
        mounted = false;
    }

    function start() {
        mount();
        startRotation();
    }

    function stop() {
        unmount();
    }

    function showError(message, retryHandler = null) {
        clearTimers();
        loader.innerHTML = `
            <div class="text-center">
                <div class="alert alert-danger mb-2" role="alert" style="white-space: normal;">
                    ${message}
                </div>
                ${retryHandler ? '<button class="btn btn-sm btn-primary retry-btn">Попробовать снова</button>' : ''}
            </div>
        `;
        if (retryHandler) {
            const btn = loader.querySelector(".retry-btn");
            if (btn) {
                btn.addEventListener("click", (e) => {
                    btn.disabled = true;
                    loader.innerHTML = `
                        <div class="spinner-border text-primary" role="status" aria-hidden="true"></div>
                        <div class="mt-2 loader-phrase" style="min-height:1.25rem;"></div>
                    `;
                    phraseEl = loader.querySelector(".loader-phrase");
                    startRotation();
                    try { retryHandler(e); } catch (err) { console.error(err); }
                });
            }
        }
        if (!mounted) mount();
    }

    return {
        start,
        stop,
        showError,
        element: loader,
    };
}

/**
 * Маппинг типов заданий -> модули и имена экспортов.
 * Содержит иконку + читабельную русскую метку для селектора.
 *
 * key = task_type
 * value = {
 *   render: [path_to_file, exported_render_function],
 *   edit:   [path_to_file, exported_edit_function],
 *   icon:   "bi-...",
 *   label:  "Русское название"
 * }
 */
export const TASK_MAP = {
    fill_gaps: {
        render: ["/static/js/tasks/display/templates/common/fillGaps.js", "renderFillGapsTask"],
        edit:   ["/static/js/tasks/editor/templates/common/fillGaps.js", "renderFillGapsTaskEditor"],
        icon:   "bi-pen",
        label:  "Пропуски"
    },
    note: {
        render: ["/static/js/tasks/display/templates/common/note.js", "renderNoteTask"],
        edit:   ["/static/js/tasks/editor/templates/common/note.js", "renderNoteTaskEditor"],
        icon:   "bi-stickies",
        label:  "Заметка"
    },
    text_input: {
        render: ["/static/js/tasks/display/templates/common/textInput.js", "renderTextInputTask"],
        edit:   ["/static/js/tasks/editor/templates/common/textInput.js", "renderTextInputTaskEditor"],
        icon:   "bi-text-paragraph",
        label:  "Текст"
    },
    true_false: {
        render: ["/static/js/tasks/display/templates/common/trueFalse.js", "renderTrueFalseTask"],
        edit:   ["/static/js/tasks/editor/templates/common/trueFalse.js", "renderTrueFalseTaskEditor"],
        icon:   "bi-check2-circle",
        label:  "Утверждения"
    },
    match_cards: {
        render: ["/static/js/tasks/display/templates/common/matchCards.js", "renderMatchCardsTask"],
        edit:   ["/static/js/tasks/editor/templates/common/matchCards.js", "renderMatchCardsTaskEditor"],
        icon:   "bi-arrow-left-right",
        label:  "Карточки"
    },
    integration: {
        render: ["/static/js/tasks/display/templates/common/integration.js", "renderIntegrationTask"],
        edit:   ["/static/js/tasks/editor/templates/common/integration.js", "renderIntegrationTaskEditor"],
        icon:   "bi-puzzle",
        label:  "Интеграция"
    },
    test: {
        render: ["/static/js/tasks/display/templates/common/test.js", "renderTestTask"],
        edit:   ["/static/js/tasks/editor/templates/common/test.js", "renderTestTaskEditor"],
        icon:   "bi-list-check",
        label:  "Тест"
    },
    file: {
        render: ["/static/js/tasks/display/templates/common/file.js", "renderFileTask"],
        edit:   ["/static/js/tasks/editor/templates/common/file.js", "renderFileTaskEditor"],
        icon:   "bi-file-earmark",
        label:  "Файлы"
    },
    whiteboard: {
        render: ["/static/js/tasks/display/templates/common/whiteboard.js", "renderWhiteboardTask"],
        edit:   ["/static/js/tasks/editor/templates/common/whiteboard.js", "renderWhiteboardTaskEditor"],
        icon:   "bi-easel",
        label:  "Доска"
    },
    word_list: {
        render: ["/static/js/tasks/display/templates/languages/wordList.js", "renderWordListTask"],
        edit:   ["/static/js/tasks/editor/templates/languages/wordList.js", "renderWordListTaskEditor"],
        icon:   "bi-book",
        label:  "Лексика"
    },
};

/**
 * Читает sectionId из #info dataset
 * @returns {string|null}
 */
export function readSectionId() {
    const info = document.getElementById("info");
    return info?.dataset?.sectionId || null;
}

/**
 * Загружает отдельное задание по ID
 * @param {string} taskId
 * @returns {Promise<Object|null>}
 */
export async function fetchSingleTask(taskId) {
    try {
        const res = await fetch(`/courses/get-task/${taskId}/`);
        if (!res.ok) throw new Error("Ошибка запроса");
        return await res.json();
    } catch (err) {
        console.error("fetchSingleTask error:", err);
        return null;
    }
}

/**
 * Простая функция экранирования для value/HTML вставок.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str = "") {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}

export function generateId(prefix = "id") {
    return prefix + "-" + Math.random().toString(36).substr(2, 9);
}

export function getInfoElement() {
    return document.getElementById("info");
}

export function getIsTeacher() {
    const infoEl = getInfoElement();
    return infoEl?.dataset?.isTeacher === "true";
}

export function getIsClassroom() {
    const infoEl = getInfoElement();
    return Boolean(infoEl?.dataset?.classroomId);
}

export function getLessonId() {
    const infoEl = getInfoElement();
    return infoEl?.dataset?.lessonId || null;
}

export function getSectionId() {
    const infoEl = getInfoElement();
    return infoEl?.dataset?.sectionId || null;
}

export function getCurrentUserId() {
    const infoEl = getInfoElement();
    return infoEl?.dataset?.currentUserId || null;
}

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
        "SPAN",
    ]);

    /**
     * Выполняет in-place очистку DOM внутри переданного корневого узла.
     *
     * Убирает атрибуты у разрешённых тегов и разворачивает (unwrap) запрещённые теги,
     * перемещая их детей на место тега. Изменения делаются без полной перезаписи
     * innerHTML — это помогает сохранить Selection/курсор.
     *
     * @param {HTMLElement} root
     */
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
        const container = document.createElement("div");
        container.innerHTML = html;

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

    editor.addEventListener("beforeinput", (event) => {
        if (event.inputType !== "insertFromPaste") return;

        event.preventDefault();

        let text = event.dataTransfer.getData("text/plain");
        text = text.replace(/\*/g, "");
        text = text.replace(/\#/g, "");
        text = text.replace(/\—/g, "");

        document.execCommand("insertText", false, text);
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