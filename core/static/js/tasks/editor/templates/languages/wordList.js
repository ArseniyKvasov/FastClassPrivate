import { showNotification, escapeHtml } from "js/tasks/utils.js";

/**
 * Рендерит редактор задания типа «Список слов».
 *
 * @param {{words?: Array<{word: string, translation: string}>}|null} taskData
 * @param {string|null} taskId
 * @returns {HTMLElement}
 */
export function renderWordListTaskEditor(taskData = null, taskId = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Список слов</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="word-translation-container mb-3"></div>

        <button class="btn btn-link text-primary fw-semibold mt-3 px-0 add-word-btn" style="border:none;">
            <i class="bi bi-plus me-1"></i>Добавить слово
        </button>

        <button class="btn btn-success mt-2 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const wrapper = card.querySelector(".word-translation-container");

    card.querySelector(".add-word-btn")
        .addEventListener("click", () => {
            const newRow = addWordTranslationRow(wrapper);
            newRow.querySelector(".word-input").focus();
        });

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => card.remove());

    const initial = taskData?.words || [];
    if (initial.length) {
        initial.forEach((w, index) => {
            const row = addWordTranslationRow(wrapper, w.word, w.translation);

            if (index === 0) {
                setTimeout(() => {
                    const firstInput = row.querySelector(".word-input");
                    if (firstInput) firstInput.focus();
                }, 550);
            }
        });
    } else {
        const firstRow = addWordTranslationRow(wrapper);
        addWordTranslationRow(wrapper);

        setTimeout(() => {
            const firstInput = firstRow.querySelector(".word-input");
            if (firstInput) firstInput.focus();
        }, 550);
    }

    card.addEventListener("paste", (e) => handleAutoPasteWordTranslations(e, wrapper));

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    return card;
}

/**
 * Добавляет строку «слово — перевод».
 *
 * @param {HTMLElement} container
 * @param {string} wordValue
 * @param {string} translationValue
 * @returns {HTMLElement}
 */
export function addWordTranslationRow(container, wordValue = "", translationValue = "") {
    const row = document.createElement("div");
    row.className = "word-translation-row d-flex align-items-center gap-2 mb-2";

    row.innerHTML = `
        <input
            type="text"
            class="form-control word-input"
            placeholder="Слово"
            style="max-width: 42%;"
            value="${escapeHtml(wordValue)}"
        >
        <i
            class="bi bi-arrow-left-right text-secondary fs-5 swap-btn"
            title="Поменять местами"
            style="cursor: pointer;"
        ></i>
        <input
            type="text"
            class="form-control translation-input"
            placeholder="Перевод"
            style="max-width: 42%;"
            value="${escapeHtml(translationValue)}"
        >
        <button class="btn-close remove-row-btn" title="Удалить" style="transform: scale(0.7);"></button>
    `;

    const wordInput = row.querySelector(".word-input");
    const translationInput = row.querySelector(".translation-input");
    const swapBtn = row.querySelector(".swap-btn");

    row.querySelector(".remove-row-btn")
        .addEventListener("click", () => row.remove());

    swapBtn.addEventListener("click", () => {
        const tmp = wordInput.value;
        wordInput.value = translationInput.value;
        translationInput.value = tmp;
        wordInput.focus();
    });

    wordInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            translationInput.focus();
        }
    });

    translationInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const rows = [...container.querySelectorAll(".word-translation-row")];
            const index = rows.indexOf(row);
            const next = rows[index + 1]?.querySelector(".word-input");

            if (next) {
                next.focus();
            } else {
                const newRow = addWordTranslationRow(container);
                newRow.querySelector(".word-input").focus();
            }
        }
    });

    container.appendChild(row);
    return row;
}

/**
 * Обрабатывает автoвставку слов с переводом из буфера.
 *
 * Поддерживаемые форматы:
 * word - translation
 * word — translation
 * word | translation
 * word<TAB>translation
 *
 * @param {ClipboardEvent} e
 * @param {HTMLElement} container
 */
export function handleAutoPasteWordTranslations(e, container) {
    const text = e.clipboardData?.getData("text/plain");
    if (!text) return;

    if (!/[-–—]|[|]|\t/.test(text)) return;

    const targetInput = e.target.closest("input");
    if (!targetInput) return;

    e.preventDefault();

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;

    [...container.querySelectorAll(".word-translation-row")].forEach(row => {
        const w = row.querySelector(".word-input").value.trim();
        const t = row.querySelector(".translation-input").value.trim();
        if (!row.contains(targetInput) && !w && !t) row.remove();
    });

    let inserted = 0;
    let rows = [];

    lines.forEach(line => {
        const dashRegex = /\s[-–—]\s/;

        let word = "";
        let translation = "";

        if (dashRegex.test(line)) {
            const parts = line.split(dashRegex);
            word = parts[0];
            translation = parts.slice(1).join(" ");
        } else if (/\t+|[|]/.test(line)) {
            const parts = line.split(/\t+|[|]/).map(p => p.trim());
            if (parts.length >= 2) {
                word = parts.slice(0, -1).join(" ");
                translation = parts.at(-1);
            }
        }

        word = cleanText(word);
        translation = cleanText(translation);

        if (word || translation) {
            const row = addWordTranslationRow(container, word, translation);
            rows.push(row);
            inserted++;
        }
    });

    [...container.querySelectorAll(".word-translation-row")].forEach(row => {
        const w = row.querySelector(".word-input").value.trim();
        const t = row.querySelector(".translation-input").value.trim();
        if (!w && !t) row.remove();
    });

    if (rows.length > 0) {
        setTimeout(() => {
            rows[0].querySelector(".word-input")?.focus();
        }, 50);
    }

    if (!inserted) {
        showNotification("Не удалось распознать слова с переводом.");
    }
}

function cleanText(s) {
    if (!s) return "";
    s = s.trim();
    s = s.replace(/^[`"'«»]\s*/, "").replace(/\s*[`"'«»]$/, "");
    s = s.replace(/^(?:\d+\s*[\.\)]\s*)+/u, "");
    s = s.replace(/\s{2,}/g, " ");
    return s.trim();
}