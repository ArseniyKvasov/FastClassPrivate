import { showNotification } from "/static/js/tasks/utils.js";

/**
 * Рендерит редактор задания типа «Текстовая заметка».
 *
 * @param {number|null} taskId
 * @param {HTMLElement|null} container
 * @param {{content?: string}|null} taskData
 */
export function renderNoteTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    const content = taskData?.content || "";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">
                <i class="bi bi-journal-text me-1"></i> Текстовая заметка
            </h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="toolbar mb-2 d-flex flex-wrap gap-2">
            <button class="btn btn-sm btn-light border format-btn" data-cmd="bold">
                <i class="bi bi-type-bold"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="italic">
                <i class="bi bi-type-italic"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="underline">
                <i class="bi bi-type-underline"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="insertUnorderedList">
                <i class="bi bi-list-ul"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-cmd="insertOrderedList">
                <i class="bi bi-list-ol"></i>
            </button>
            <button class="btn btn-sm btn-light border clear-format-btn">
                <i class="bi bi-eraser"></i>
            </button>
        </div>

        <div class="note-editor border rounded p-2"
             contenteditable="true"
             style="min-height: 160px; outline: none;">${content}</div>

        <button class="btn btn-success mt-3 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const editor = card.querySelector(".note-editor");

    const normalizeText = (text) => {
        return text
            .replace(/—/g, '-')
            .replace(/–/g, '-')
            .replace(/−/g, '-')
            .replace(/―/g, '-')
            .replace(/／/g, '/')
            .replace(/⁄/g, '/');
    };

    const cleanPastedHTML = (html) => {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        const walker = document.createTreeWalker(
            temp,
            NodeFilter.SHOW_ELEMENT,
            null,
            false
        );

        const allowedStyles = ['font-weight', 'font-style', 'text-decoration'];
        const nodes = [];
        let node;

        while (node = walker.nextNode()) {
            nodes.push(node);
        }

        nodes.forEach(node => {
            if (node.style) {
                const styles = Array.from(node.style);
                styles.forEach(styleName => {
                    if (!allowedStyles.includes(styleName)) {
                        node.style.removeProperty(styleName);
                    }
                });

                if (node.style.cssText.trim() === '') {
                    node.removeAttribute('style');
                }
            }

            ['class', 'id'].forEach(attr => {
                node.removeAttribute(attr);
            });
        });

        return temp.innerHTML;
    };

    const handleFormatKey = (e) => {
        if (!e.ctrlKey && !e.metaKey) return;

        let command = null;
        let shouldPreventDefault = true;

        switch (e.key.toLowerCase()) {
            case 'b':
                command = 'bold';
                break;
            case 'i':
                command = 'italic';
                break;
            case 'u':
                command = 'underline';
                break;
            case 'l':
                if (e.shiftKey) {
                    command = 'insertOrderedList';
                } else {
                    command = 'insertUnorderedList';
                }
                break;
            default:
                shouldPreventDefault = false;
                return;
        }

        if (command) {
            e.preventDefault();
            document.execCommand(command, false, null);

            const btn = card.querySelector(`.format-btn[data-cmd="${command}"]`);
            if (btn) {
                btn.classList.add('active');
                setTimeout(() => btn.classList.remove('active'), 200);
            }
        }
    };

    const handleSelectAllKey = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            const range = document.createRange();
            range.selectNodeContents(editor);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
    };

    const handleClearFormatKey = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'x') {
            e.preventDefault();
            const text = editor.innerText;
            editor.innerHTML = text.replace(/\n/g, "<br>");

            const btn = card.querySelector('.clear-format-btn');
            if (btn) {
                btn.classList.add('active');
                setTimeout(() => btn.classList.remove('active'), 200);
            }
        }
    };

    editor.addEventListener('keydown', (e) => {
        handleSelectAllKey(e);
        handleFormatKey(e);
        handleClearFormatKey(e);
    });

    editor.addEventListener('paste', (e) => {
        e.preventDefault();

        const clipboardData = e.clipboardData || window.clipboardData;

        if (clipboardData.types.includes('text/html')) {
            const html = clipboardData.getData('text/html');
            const cleaned = cleanPastedHTML(html);
            const normalized = normalizeText(cleaned);

            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            range.deleteContents();

            const temp = document.createElement('div');
            temp.innerHTML = normalized;

            const fragment = document.createDocumentFragment();
            while (temp.firstChild) {
                fragment.appendChild(temp.firstChild);
            }

            range.insertNode(fragment);
            range.setStartAfter(fragment.lastChild || fragment);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            let text = clipboardData.getData('text/plain');
            text = normalizeText(text);
            document.execCommand('insertText', false, text);
        }
    });

    card.querySelectorAll(".format-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.execCommand(btn.dataset.cmd, false, null);
            editor.focus();
        });
    });

    card.querySelector(".clear-format-btn")
        .addEventListener("click", () => {
            const text = editor.innerText;
            editor.innerHTML = text.replace(/\n/g, "<br>");
            editor.focus();
        });

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => card.remove());

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}