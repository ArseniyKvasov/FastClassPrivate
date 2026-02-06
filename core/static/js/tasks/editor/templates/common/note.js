import { showNotification } from "/static/js/tasks/utils.js";

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
            <button class="btn btn-sm btn-light border format-btn" data-md="**" title="Жирный">
                <i class="bi bi-type-bold"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-md="*" title="Курсив">
                <i class="bi bi-type-italic"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-md="__" title="Подчёркнутый">
                <i class="bi bi-type-underline"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-md="- " title="Маркированный список">
                <i class="bi bi-list-ul"></i>
            </button>
            <button class="btn btn-sm btn-light border format-btn" data-md="1. " title="Нумерованный список">
                <i class="bi bi-list-ol"></i>
            </button>
            <button class="btn btn-sm btn-light border clear-format-btn" title="Очистить форматирование">
                <i class="bi bi-eraser"></i>
            </button>
            <button class="btn btn-sm btn-light border ai-prompt-btn" title="Скопировать промпт для ИИ">
                <i class="bi bi-robot"></i>
            </button>
        </div>

        <textarea
            class="note-editor border rounded p-2 w-100"
            style="min-height: 160px; outline: none; resize: vertical;"
        >${content}</textarea>

        <button class="btn btn-success mt-3 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const editor = card.querySelector(".note-editor");
    const aiPromptBtn = card.querySelector(".ai-prompt-btn");

    const aiPrompt = `Ты генерируешь текстовые заметки для системы, которая поддерживает Markdown и LaTeX. Внимательно следуй инструкциям:

ФОРМАТИРОВАНИЕ
- **Жирный текст**
- *Курсив*
- Списки:
  - Маркированный: - элемент
  - Нумерованный: 1. элемент

МАТЕМАТИЧЕСКИЕ ФОРМУЛЫ
- Формулы оборачивай в LaTeX:
  - Встроенные формулы: $формула$
  - Отдельные формулы: $$формула$$
  - Пример: $$\frac{a}{b} + \frac{c}{d} = \frac{ad + bc}{bd}$$

ОСОБЫЕ ПРАВИЛА
- НЕ используй символ #
- НЕ используй HTML теги

Тема заметки:
`;

    aiPromptBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(aiPrompt).then(() => {
            showNotification("Запрос для генерации в ИИ скопирован");
        }).catch(() => {
            showNotification("Не удалось скопировать промпт");
        });
    });

    editor.addEventListener("paste", (e) => {
        e.preventDefault();
        const pastedText = e.clipboardData.getData("text");

        let processedText = pastedText
            .replace(/^#+/gm, '')
            .replace(/—/g, '-')
            .replace(/–/g, '-')
            .replace(/―/g, '-')
            .replace(/\//g, '/');

        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const value = editor.value;

        editor.value = value.slice(0, start) + processedText + value.slice(end);
        const newPos = start + processedText.length;
        editor.selectionStart = editor.selectionEnd = newPos;
        editor.focus();
    });

    function toggleWrapSelection(wrapper) {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const value = editor.value;

        if (start > end) return;

        if (start === end) {
            const left = start - wrapper.length >= 0 ? value.slice(start - wrapper.length, start) : "";
            const right = value.slice(end, end + wrapper.length);

            if (left === wrapper && right === wrapper) {
                editor.value = value.slice(0, start - wrapper.length) + value.slice(end + wrapper.length);
                const newPos = start - wrapper.length;
                editor.selectionStart = editor.selectionEnd = newPos;
            } else {
                editor.value = value.slice(0, start) + wrapper + wrapper + value.slice(end);
                const newPos = start + wrapper.length;
                editor.selectionStart = editor.selectionEnd = newPos;
            }
        } else {
            const selected = value.slice(start, end);

            if (selected.startsWith(wrapper) && selected.endsWith(wrapper) && selected.length >= wrapper.length * 2) {
                const inner = selected.slice(wrapper.length, selected.length - wrapper.length);
                editor.value = value.slice(0, start) + inner + value.slice(end);
                editor.selectionStart = start;
                editor.selectionEnd = start + inner.length;
            } else {
                const wrapped = wrapper + selected + wrapper;
                editor.value = value.slice(0, start) + wrapped + value.slice(end);
                editor.selectionStart = start;
                editor.selectionEnd = start + wrapped.length;
            }
        }

        editor.focus();
    }

    function toggleLinePrefix(prefix) {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const value = editor.value;

        const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
        let lineEndIndex = value.indexOf("\n", end);
        if (lineEndIndex === -1) lineEndIndex = value.length;

        const block = value.slice(lineStart, lineEndIndex);
        const lines = block.split("\n");

        let allHavePrefix;
        if (prefix === "1. ") {
            allHavePrefix = lines.every(line => /^\s*\d+\.\s+/.test(line));
        } else {
            allHavePrefix = lines.every(line => line.startsWith(prefix));
        }

        const newLines = lines.map((line) => {
            if (allHavePrefix) {
                if (prefix === "1. ") {
                    return line.replace(/^\s*\d+\.\s+/, "");
                } else {
                    return line.startsWith(prefix) ? line.slice(prefix.length) : line;
                }
            } else {
                return prefix + line;
            }
        });

        const newBlock = newLines.join("\n");
        editor.value = value.slice(0, lineStart) + newBlock + value.slice(lineEndIndex);

        editor.selectionStart = lineStart;
        editor.selectionEnd = lineStart + newBlock.length;
        editor.focus();
    }

    function clearFormatting() {
        let val = editor.value;
        val = val.replace(/```[\s\S]*?```/g, match => match.replace(/./g, ""));
        val = val.replace(/`+/g, "");
        val = val.replace(/\*\*/g, "");
        val = val.replace(/__/g, "");
        val = val.replace(/\*(?=\S)/g, "");
        val = val.replace(/_(?=\S)/g, "");
        val = val.replace(/^\s{0,3}#{1,6}\s+/gm, "");
        val = val.replace(/^\s{0,3}>\s?/gm, "");
        val = val.replace(/^\s*-\s+/gm, "");
        val = val.replace(/^\s*\d+\.\s+/gm, "");
        editor.value = val;
        editor.focus();
    }

    card.querySelectorAll(".format-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const md = btn.dataset.md;
            if (md === "- " || md === "1. ") {
                toggleLinePrefix(md);
            } else {
                toggleWrapSelection(md);
            }
        });
    });

    card.querySelector(".clear-format-btn")
        .addEventListener("click", () => clearFormatting());

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => card.remove());

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}