import { showNotification, escapeHtml, generateId } from "/static/js/tasks/utils.js";

export function renderTestTaskEditor(taskData = null) {
    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Тест</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div class="questions-wrapper"></div>

        <button class="btn btn-link text-primary fw-semibold mt-3 add-question-btn px-0" style="border:none;">
            <i class="bi bi-plus me-1"></i>Добавить вопрос
        </button>

        <button class="btn btn-success mt-2 w-100 fw-semibold save-btn">
            Сохранить
        </button>
    `;

    const questionsWrapper = card.querySelector(".questions-wrapper");
    const addQuestionBtn = card.querySelector(".add-question-btn");
    const removeTaskBtn = card.querySelector(".remove-task-btn");

    let lastAnswerCount = 3;

    addQuestionBtn.addEventListener("click", () => {
        const newBlock = _addNewQuestion(questionsWrapper, null, lastAnswerCount);
        newBlock.querySelector(".question-text").focus();
    });

    removeTaskBtn.addEventListener("click", () => card.remove());

    const initialQuestions = Array.isArray(taskData?.questions) ? taskData.questions : [];
    if (initialQuestions.length) {
        initialQuestions.forEach((q, index) => {
            const block = _addNewQuestion(questionsWrapper, q);
            lastAnswerCount = Math.max(lastAnswerCount, q.options?.length || 3);

            if (index === 0) {
                setTimeout(() => {
                    const firstInput = block.querySelector(".question-text");
                    if (firstInput) firstInput.focus();
                }, 50);
            }
        });
    } else {
        const firstBlock = _addNewQuestion(questionsWrapper, null, lastAnswerCount);
        setTimeout(() => {
            const firstInput = firstBlock.querySelector(".question-text");
            if (firstInput) firstInput.focus();
        }, 50);
    }

    card.scrollIntoView({ behavior: "smooth", block: "center" });

    function setLastAnswerCount(n) {
        lastAnswerCount = Math.max(1, Math.floor(n) || 1);
    }

    function _addNewQuestion(wrapper, qData = null, answerCount = 3) {
        const block = _createQuestionBlock(qData, answerCount);
        wrapper.appendChild(block);
        return block;
    }

    function _createQuestionBlock(qData = null, answerCount = 3) {
        const qId = generateId("question");
        const questionText = qData?.question || "";

        const block = document.createElement("div");
        block.className = "question-container mb-4 p-0 p-lg-3 border-0";
        block.dataset.questionId = qId;

        block.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <input type="text"
                       class="form-control question-text"
                       placeholder="Вопрос"
                       value="${escapeHtml(questionText)}">
                <button class="btn-close remove-question-btn small ms-1"
                        type="button"
                        title="Удалить вопрос"></button>
            </div>

            <div class="answers-container mb-2"></div>

            <button class="btn border-0 add-answer-btn text-secondary px-0"
                    type="button"
                    title="Добавить вариант">
                <i class="bi bi-plus me-1"></i>Добавить вариант
            </button>
        `;

        const answersContainer = block.querySelector(".answers-container");

        block.querySelector(".remove-question-btn")
            .addEventListener("click", () => block.remove());

        block.querySelector(".add-answer-btn")
            .addEventListener("click", () => {
                const newRow = addAnswer(answersContainer, qId);
                newRow.querySelector(".answer-text").focus();
                setLastAnswerCount(answersContainer.querySelectorAll(".answer-row").length);
            });

        const options = Array.isArray(qData?.options) && qData.options.length
            ? qData.options
            : Array(answerCount).fill(null);

        options.forEach(o => {
            addAnswer(answersContainer, qId, {
                text: o?.option || "",
                is_correct: !!o?.is_correct
            });
        });

        block.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;
            const inputs = Array.from(block.querySelectorAll(".question-text, .answer-text"));
            const idx = inputs.indexOf(e.target);
            if (idx !== -1) {
                e.preventDefault();
                if (idx + 1 < inputs.length) {
                    inputs[idx + 1].focus();
                } else {
                    const newAnswer = addAnswer(answersContainer, qId);
                    newAnswer.querySelector(".answer-text").focus();
                    setLastAnswerCount(answersContainer.querySelectorAll(".answer-row").length);
                }
            }
        });

        setLastAnswerCount(answersContainer.querySelectorAll(".answer-row").length);

        return block;
    }

    questionsWrapper.addEventListener("paste", (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
        const block = target.closest(".question-container");
        if (!block) return;

        if (target.classList.contains("question-text")) {
            handlePasteInQuestionInput(e, block);
        } else if (target.classList.contains("answer-text")) {
            handlePasteInAnswerInput(e, block);
        }
    });

    function handlePasteInQuestionInput(e, currentBlock) {
        const text = (e.clipboardData || window.clipboardData).getData("text");
        if (!text) return;

        const parsed = parsePastedText(text);
        if (!parsed.length) return;
        e.preventDefault();

        const wrapper = currentBlock.closest(".questions-wrapper");
        if (!wrapper) return;

        applyParsedQuestionToBlock(currentBlock, parsed[0]);

        let cursor = Array.from(wrapper.children).indexOf(currentBlock);
        for (let i = 1; i < parsed.length; i++) {
            const newBlock = _createQuestionBlock(parsed[i], parsed[i].options?.length || lastAnswerCount);
            cursor++;
            if (cursor < wrapper.children.length) {
                wrapper.insertBefore(newBlock, wrapper.children[cursor]);
            } else {
                wrapper.appendChild(newBlock);
            }
        }

        const firstAnsCount = parsed[0].options?.length || 0;
        setLastAnswerCount(Math.max(lastAnswerCount, firstAnsCount));
    }

    function handlePasteInAnswerInput(e, currentBlock) {
        const text = (e.clipboardData || window.clipboardData).getData("text");
        if (!text) return;

        const parsed = parsePastedText(text);
        if (!parsed.length) return;
        e.preventDefault();

        const wrapper = currentBlock.closest(".questions-wrapper");
        if (!wrapper) return;

        const activeAnswerRow = document.activeElement.closest(".answer-row");
        const answersContainer = currentBlock.querySelector(".answers-container");

        if (parsed.length === 1) {
            const lines = parsed[0].options.map(o => o.option).filter(Boolean);
            if (!lines.length) return;
            if (activeAnswerRow) {
                const input = activeAnswerRow.querySelector(".answer-text");
                if (input) input.value = lines.shift() || "";
            }

            lines.forEach(l => {
                const newRow = addAnswer(answersContainer, currentBlock.dataset.questionId, { text: l });
                newRow.querySelector(".answer-text").focus();
            });

            setLastAnswerCount(answersContainer.querySelectorAll(".answer-row").length);
            return;
        }

        applyParsedQuestionToBlock(currentBlock, parsed[0]);

        let cursor = Array.from(wrapper.children).indexOf(currentBlock);
        for (let i = 1; i < parsed.length; i++) {
            const newBlock = _createQuestionBlock(parsed[i], parsed[i].options?.length || lastAnswerCount);
            cursor++;
            if (cursor < wrapper.children.length) {
                wrapper.insertBefore(newBlock, wrapper.children[cursor]);
            } else {
                wrapper.appendChild(newBlock);
            }
        }
    }

    function applyParsedQuestionToBlock(block, parsedQuestion) {
        const qInput = block.querySelector(".question-text");
        const answersContainer = block.querySelector(".answers-container");

        if (qInput) qInput.value = parsedQuestion.question || "";

        answersContainer.innerHTML = "";

        const opts = Array.isArray(parsedQuestion.options) && parsedQuestion.options.length
            ? parsedQuestion.options
            : [{ option: "" }];

        opts.forEach(o => addAnswer(answersContainer, block.dataset.questionId, {
            text: o.option || "",
            is_correct: !!o.is_correct
        }));
    }

    return card;
}

export function addAnswer(container, questionId, answerData = null) {
    const aId = generateId("answer");
    const isChecked = answerData?.is_correct ? "checked" : "";
    const textValue = answerData?.text || "";

    const row = document.createElement("div");
    row.className = "answer-row mb-2 d-flex align-items-center me-4 ms-2";

    const checkboxId = `correct-${questionId}-${aId}`;

    row.innerHTML = `
        <input type="checkbox"
               class="form-check-input correct-answer-checkbox me-3 mb-1"
               style="transform: scale(1.5);"
               id="${checkboxId}"
               autocomplete="off"
               ${isChecked}>
        <input type="text"
               class="form-control answer-text"
               placeholder="Ответ"
               value="${escapeHtml(textValue)}">
        <button class="btn-close remove-answer-btn ms-2 small"
                style="transform: scale(0.75);"
                type="button"
                title="Удалить вариант"></button>
    `;

    row.querySelector(".remove-answer-btn")
        .addEventListener("click", () => row.remove());

    container.appendChild(row);

    return row;
}

function parsePastedText(rawText) {
    const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const blocks = text.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);

    const parsed = [];
    for (let b of blocks) {
        const part = _parseSingleBlock(b);
        if (Array.isArray(part)) {
            parsed.push(...part);
        } else if (part) {
            parsed.push(part);
        }
    }

    return parsed;
}

function _parseSingleBlock(blockText) {
    const rawLines = blockText.split("\n");
    const lines = rawLines.map(l => l.replace(/\u00A0/g, " ").replace(/\t/g, " ").trim()).filter(Boolean);

    if (!lines.length) return [];

    const questionLineRe = /^\s*(\d+)[\.\)]\s*(.*)$/;
    const optionLineRe = /^\s*([\p{L}0-9]+)[\.\)\]]\s*(.*)$/u;
    const bulletRe = /^\s*[-–—*]\s*(.*)$/;

    const results = [];
    let current = null;

    function pushCurrent() {
        if (!current) return;
        if (!current.question) current.question = "";
        if (!Array.isArray(current.options)) current.options = [];
        results.push(current);
        current = null;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const qMatch = line.match(questionLineRe);
        const oMatch = line.match(optionLineRe);
        const bMatch = line.match(bulletRe);

        if (qMatch) {
            pushCurrent();
            current = { question: qMatch[2].trim() || "", options: [] };
            continue;
        }

        if (oMatch) {
            if (!current) current = { question: "", options: [] };
            current.options.push({ option: oMatch[2].trim() });
            continue;
        }

        if (bMatch) {
            if (!current) current = { question: "", options: [] };
            current.options.push({ option: bMatch[1].trim() });
            continue;
        }

        let j = i + 1;
        let nextIsOption = false;
        while (j < lines.length) {
            if (!lines[j]) {
                j++;
                continue;
            }
            if (optionLineRe.test(lines[j]) || bulletRe.test(lines[j])) {
                nextIsOption = true;
            }
            break;
        }

        if (!current) {
            current = { question: line, options: [] };
            continue;
        }

        if (current.options.length === 0) {
            if (nextIsOption) {
                pushCurrent();
                current = { question: line, options: [] };
            } else {
                current.question = (current.question + " " + line).trim();
            }
            continue;
        }

        if (current.options.length > 0 && nextIsOption) {
            pushCurrent();
            current = { question: line, options: [] };
            continue;
        }

        if (current.options.length > 0) {
            const last = current.options[current.options.length - 1];
            last.option = (last.option + " " + line).trim();
        } else {
            current.question = (current.question + " " + line).trim();
        }
    }

    pushCurrent();

    return results;
}