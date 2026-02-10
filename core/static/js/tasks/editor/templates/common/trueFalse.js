import { showNotification, escapeHtml, generateId } from "js/tasks/utils.js";

/**
 * Рендер редактора задания True / False с поддержкой Enter и вставок.
 *
 * @param {{statements?: Array<{statement: string, is_true: boolean}>}|null} taskData
 */
export function renderTrueFalseTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Правда или ложь</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="truefalse-statements mb-3"></div>

        <button class="btn btn-link text-primary fw-semibold mt-3 add-statement-btn px-0" style="border:none;">
            <i class="bi bi-plus me-1"></i>Добавить утверждение
        </button>

        <button class="btn btn-success mt-2 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const wrapper = card.querySelector(".truefalse-statements");
    const addBtn = card.querySelector(".add-statement-btn");
    const removeBtn = card.querySelector(".remove-task-btn");

    addBtn.addEventListener("click", () => {
        const newRow = addTrueFalseStatement(wrapper);
        newRow.querySelector(".statement-text").focus();
    });

    removeBtn.addEventListener("click", () => card.remove());

    if (Array.isArray(taskData?.statements) && taskData.statements.length) {
        taskData.statements.forEach((s, index) => {
            const row = addTrueFalseStatement(wrapper, escapeHtml(s.statement), s.is_true ? "true" : "false");

            if (index === 0) {
                setTimeout(() => {
                    const firstInput = row.querySelector(".statement-text");
                    if (firstInput) firstInput.focus();
                }, 50);
            }
        });
    } else {
        const firstRow = addTrueFalseStatement(wrapper);
        setTimeout(() => {
            const firstInput = firstRow.querySelector(".statement-text");
            if (firstInput) firstInput.focus();
        }, 50);
    }

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    wrapper.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        const inputs = Array.from(wrapper.querySelectorAll(".statement-text"));
        const idx = inputs.indexOf(e.target);
        if (idx !== -1) {
            e.preventDefault();
            if (idx + 1 < inputs.length) {
                inputs[idx + 1].focus();
            } else {
                const newRow = addTrueFalseStatement(wrapper);
                newRow.querySelector(".statement-text").focus();
            }
        }
    });

    wrapper.addEventListener("paste", (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;
        const text = (e.clipboardData || window.clipboardData).getData("text");
        if (!text) return;

        e.preventDefault();

        const parsedStatements = parsePastedTrueFalse(text);

        const firstRow = target.closest(".statement-row");
        if (firstRow && parsedStatements.length) {
            const first = parsedStatements.shift();
            firstRow.querySelector(".statement-text").value = first.text;
            firstRow.querySelector(".statement-select").value = first.value;

            let idx = Array.from(wrapper.children).indexOf(firstRow);
            parsedStatements.forEach(s => {
                const newRow = addTrueFalseStatement(wrapper, s.text, s.value);
                idx++;
                wrapper.insertBefore(newRow, wrapper.children[idx + 1] || null);
            });
        }
    });

    return card;
}

/**
 * Добавляет строку утверждения True / False.
 *
 * @param {HTMLElement} container
 * @param {string} textValue
 * @param {"true"|"false"} value
 * @returns {HTMLElement} созданный элемент
 */
export function addTrueFalseStatement(container, textValue = "", value = "false") {
    const sId = generateId("statement");

    const row = document.createElement("div");
    row.className = "statement-row d-flex align-items-center gap-2 mb-2";
    row.dataset.statementId = sId;

    row.innerHTML = `
        <select class="form-select statement-select" style="width: 120px;">
            <option value="true" ${value === "true" ? "selected" : ""}>Правда</option>
            <option value="false" ${value === "false" ? "selected" : ""}>Ложь</option>
        </select>

        <input
            type="text"
            class="form-control statement-text"
            placeholder="Утверждение"
            value="${escapeHtml(textValue)}">

        <button
            class="btn-close remove-statement-btn"
            title="Удалить утверждение"
            style="transform: scale(0.7);"></button>
    `;

    row.querySelector(".remove-statement-btn").addEventListener("click", () => row.remove());

    container.appendChild(row);
    return row;
}

/**
 * Сбор данных True / False из карточки
 */
export function collectTrueFalseData(card) {
    const statements = [];
    card.querySelectorAll(".statement-row").forEach(row => {
        const textInput = row.querySelector(".statement-text");
        const select = row.querySelector(".statement-select");
        if (textInput.value.trim()) {
            statements.push({
                statement: textInput.value.trim(),
                is_true: select.value === "true"
            });
        }
    });
    return statements;
}

function parsePastedTrueFalse(rawText) {
    const lines = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map(l => l.trim()).filter(Boolean);
    const results = [];

    const correctPatterns = [
        /^\s*(.*?)\s*\(\s*(верно|правильный ответ|true|правильно|correct|✓|✔|✅)\s*\)\s*$/i,
        /^\s*(.*?)\s*\[\s*(верно|правильный ответ|true|правильно|correct|✓|✔|✅)\s*\]\s*$/i,
        /^\s*(.*?)\s*-\s*(верно|правильный ответ|true|правильно|correct|✓|✔|✅)\s*$/i,
        /^\s*(.*?)\s*\(✓\)\s*$/i,
        /^\s*(.*?)\s*\[✓\]\s*$/i,
        /^\s*(.*?)\s*✓\s*$/,
        /^\s*(.*?)\s*✔\s*$/,
        /^\s*(.*?)\s*✅\s*$/,
        /^\s*(✓|✔|✅)\s*(.*?)\s*$/,
        /^\s*(.*?)\s*(✓|✔|✅)\s*$/
    ];

    const incorrectPatterns = [
        /^\s*(.*?)\s*\(\s*(неверно|false|неправильно|incorrect|✗|✘|❌)\s*\)\s*$/i,
        /^\s*(.*?)\s*\[\s*(неверно|false|неправильно|incorrect|✗|✘|❌)\s*\]\s*$/i,
        /^\s*(.*?)\s*-\s*(неверно|false|неправильно|incorrect|✗|✘|❌)\s*$/i,
        /^\s*(.*?)\s*\(✗\)\s*$/i,
        /^\s*(.*?)\s*\[✗\]\s*$/i,
        /^\s*(.*?)\s*✗\s*$/,
        /^\s*(.*?)\s*✘\s*$/,
        /^\s*(.*?)\s*❌\s*$/,
        /^\s*(✗|✘|❌)\s*(.*?)\s*$/,
        /^\s*(.*?)\s*(✗|✘|❌)\s*$/
    ];

    lines.forEach(line => {
        let text = line;
        let value = "false";
        let matched = false;

        for (const pattern of correctPatterns) {
            const match = line.match(pattern);
            if (match) {
                text = match[1] || match[2] || match[3] || '';
                value = "true";
                matched = true;
                break;
            }
        }

        if (!matched) {
            for (const pattern of incorrectPatterns) {
                const match = line.match(pattern);
                if (match) {
                    text = match[1] || match[2] || match[3] || '';
                    value = "false";
                    matched = true;
                    break;
                }
            }
        }

        if (!matched) {
            if (/\(?\s*(Верно|True|Правда)\s*\)?/i.test(line)) {
                value = "true";
            }

            if (/\(?\s*(Неверно|Ложь|False)\s*\)?/i.test(line)) {
                value = "false";
            }

            text = line.replace(/\(\s*(Верно|Неверно|True|False|Правда|Ложь|True\s*\/\s*False|Правда\s*или\s*ложь)\s*\)/ig, "")
                      .replace(/\[\s*(Верно|Неверно|True|False|Правда|Ложь)\s*\]/ig, "")
                      .replace(/\s*-\s*(Верно|Неверно|True|False|Правда|Ложь)\s*$/ig, "")
                      .replace(/[✓✔✅✗✘❌]/g, "")
                      .trim();
        }

        text = text.replace(/^\s*[\.\-\*]\s*/, "").trim();

        if (text) {
            results.push({ text, value });
        }
    });

    return results;
}