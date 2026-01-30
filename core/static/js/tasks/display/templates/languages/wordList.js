import { showNotification, escapeHtml } from "/static/js/tasks/utils.js";

/**
 * Рендерит минималистичный красивый список слов с кнопкой "Практиковать".
 *
 * @param {Object} task
 * @param {Object} task.data
 * @param {Array<{word: string, translation: string}>} task.data.words
 * @param {HTMLElement} container
 */
export function renderWordListTask(task, container) {
    if (!container) return;
    container.innerHTML = "";

    const words = Array.isArray(task?.data?.words) ? task.data.words.slice() : null;
    if (!words) {
        container.innerHTML = "<div class='text-danger'>Некорректные данные: ожидается task.data.words</div>";
        return;
    }

    const title = document.createElement("div");
    title.className = "d-flex justify-content-start align-items-center mb-3";
    title.innerHTML = `<h5 class="mb-0 fw-semibold">Список слов</h5>`;
    container.appendChild(title);

    const listHolder = document.createElement("div");
    listHolder.className = "word-list-holder mb-3";
    container.appendChild(listHolder);

    let translationsVisible = false;

    function renderList() {
        listHolder.innerHTML = "";

        if (!words.length) {
            listHolder.innerHTML = "<div class='text-muted'>Слов нет.</div>";
            return;
        }

        const row = document.createElement("div");
        row.className = "row g-3";

        const half = Math.ceil(words.length / 2);
        const cols = [
            words.slice(0, half),
            words.slice(half)
        ];

        cols.forEach(colWords => {
            const col = document.createElement("div");
            col.className = "col-12 col-md-6";

            const list = document.createElement("div");
            list.className = "list-group rounded-4 shadow-sm overflow-hidden";

            colWords.forEach(item => {
                const w = escapeHtml(String(item?.word ?? "").trim());
                const t = escapeHtml(String(item?.translation ?? "").trim());

                const li = document.createElement("div");
                li.className = "list-group-item d-flex justify-content-between align-items-center py-3";
                const rightHtml = translationsVisible
                    ? `<div class="text-muted small text-end translation" style="min-width:120px;">${t}</div>`
                    : `<div class="text-muted small text-end translation d-none" style="min-width:120px;"></div>`;
                li.innerHTML = `
                    <div class="fw-medium">${w}</div>
                    ${rightHtml}
                `;
                list.appendChild(li);
            });

            col.appendChild(list);
            row.appendChild(col);
        });

        listHolder.appendChild(row);

        const footer = document.createElement("div");
        footer.className = "d-flex justify-content-end align-items-stretch mt-3 gap-2";
        footer.innerHTML = `
            <button class="btn btn-outline-primary btn-sm toggle-view-btn">${translationsVisible ? "Скрыть перевод" : "Показать перевод"}</button>
            <button class="btn btn-primary btn-sm practice-btn">Практиковать</button>
        `;
        listHolder.appendChild(footer);

        const toggleBtn = footer.querySelector(".toggle-view-btn");
        const practiceBtn = footer.querySelector(".practice-btn");

        toggleBtn.addEventListener("click", () => {
            translationsVisible = !translationsVisible;
            renderList();
        });

        practiceBtn.addEventListener("click", () => {
            renderPracticeMenu(container, words, () => renderWordListTask(task, container));
        });
    }

    renderList();
}

/**
 * Рендерит меню практики и запускает выбранный режим.
 *
 * @param {HTMLElement} container
 * @param {Array<{word:string, translation:string}>} words
 * @param {Function} onBack
 */
export function renderPracticeMenu(container, words, onBack) {
    container.innerHTML = "";

    const title = document.createElement("div");
    title.className = "mb-3";
    title.innerHTML = `<h5 class="mb-0 fw-semibold">Практика</h5>`;
    container.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "row g-3 mb-4";

    const modes = [
        { key: "flash", label: "Флеш-карты", icon: "bi-book" },
        { key: "choice", label: "Выбрать перевод", icon: "bi-list-check" },
        { key: "assemble", label: "Составить слово", icon: "bi-type" },
        { key: "input", label: "Вписать перевод", icon: "bi-pencil" }
    ];

    modes.forEach(mode => {
        const col = document.createElement("div");
        col.className = "col-12 col-md-6";

        const btn = document.createElement("button");
        btn.className = "btn w-100 d-flex align-items-center justify-content-start p-3 rounded-4 shadow-sm";
        btn.style.background = "var(--bs-light)";
        btn.innerHTML = `
            <i class="${mode.icon} fs-3 me-3"></i>
            <div class="text-start">
                <div class="fw-semibold">${mode.label}</div>
                <div class="small text-muted">Быстрая практика из списка</div>
            </div>
        `;

        btn.addEventListener("click", () => {
            if (!Array.isArray(words) || words.length < 1) {
                showNotification("Нет слов для практики.");
                return;
            }

            if (mode.key === "flash") startFlashcards(container, words, () => renderPracticeMenu(container, words, onBack));
            if (mode.key === "choice") startChoice(container, words, () => renderPracticeMenu(container, words, onBack));
            if (mode.key === "assemble") startAssemble(container, words, () => renderPracticeMenu(container, words, onBack));
            if (mode.key === "input") startInput(container, words, () => renderPracticeMenu(container, words, onBack));
        });

        col.appendChild(btn);
        grid.appendChild(col);
    });

    container.appendChild(grid);

    const footer = document.createElement("div");
    footer.className = "d-flex justify-content-end";
    const backBtn = document.createElement("button");
    backBtn.className = "btn btn-sm btn-outline-secondary";
    backBtn.textContent = "Назад";
    backBtn.addEventListener("click", onBack);
    footer.appendChild(backBtn);
    container.appendChild(footer);
}

/**
 * Простая утилита: удаляет эмодзи из строки.
 */
function removeEmojis(s) {
    if (!s) return "";
    return String(s).replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "");
}

/**
 * Нормализация для сравнения: убираем эмодзи, пунктуацию .,;:!?()[]{}«»"', и приводим к lower-case.
 */
function normalizeForCompare(s) {
    if (s == null) return "";
    let t = String(s);
    t = removeEmojis(t);
    t = t.replace(/[.,!?:;()\[\]{}«»"“”'`~—–\-]/g, "");
    t = t.replace(/\s+/g, " ").trim().toLowerCase();
    return t;
}

/**
 * Флеш-карты: компактные управляющие кнопки, reveal button disabled после показа.
 *
 * @param {HTMLElement} container
 * @param {Array<{word:string, translation:string}>} words
 * @param {Function} onBack
 */
export function startFlashcards(container, words, onBack) {
    container.innerHTML = "";

    const title = document.createElement("div");
    title.className = "mb-3";
    title.innerHTML = `<h5 class="mb-0 fw-semibold">Флеш-карты</h5>`;
    container.appendChild(title);

    const cardWrap = document.createElement("div");
    cardWrap.className = "d-flex flex-column align-items-center gap-3";
    container.appendChild(cardWrap);

    const card = document.createElement("div");
    card.className = "card rounded-4 shadow-sm p-4 text-center";
    card.style.minWidth = "240px";
    card.style.maxWidth = "520px";

    const wordEl = document.createElement("div");
    wordEl.className = "h4 fw-semibold mb-2";

    const translationEl = document.createElement("div");
    translationEl.className = "text-muted small mb-3 visually-hidden";

    const controls = document.createElement("div");
    controls.className = "d-flex justify-content-center align-items-center gap-2";

    const prevBtn = document.createElement("button");
    prevBtn.className = "btn btn-link p-0 border-0";
    prevBtn.innerHTML = `<i class="bi bi-arrow-left fs-5"></i>`;

    const revealBtn = document.createElement("button");
    revealBtn.className = "btn btn-outline-primary btn-sm mx-2";
    revealBtn.textContent = "Показать";

    const nextBtn = document.createElement("button");
    nextBtn.className = "btn btn-link p-0 border-0";
    nextBtn.innerHTML = `<i class="bi bi-arrow-right fs-5"></i>`;

    controls.appendChild(prevBtn);
    controls.appendChild(revealBtn);
    controls.appendChild(nextBtn);

    card.appendChild(wordEl);
    card.appendChild(translationEl);
    card.appendChild(controls);

    cardWrap.appendChild(card);

    let deck = words.map(w => ({ word: String(w.word ?? ""), translation: String(w.translation ?? "") }));
    deck = deck.filter(d => d.word);
    if (!deck.length) {
        container.innerHTML = "<div class='text-muted'>Нет валидных слов для флеш-карт.</div>";
        return;
    }

    let index = 0;

    function showIndex(i) {
        const item = deck[i];
        wordEl.innerHTML = escapeHtml(item.word);
        translationEl.innerHTML = escapeHtml(item.translation);
        translationEl.classList.add("visually-hidden");
        revealBtn.disabled = false;
    }

    function shuffleDeck() {
        deck = shuffle(deck);
        index = 0;
        showIndex(index);
    }

    revealBtn.addEventListener("click", () => {
        translationEl.classList.remove("visually-hidden");
        revealBtn.disabled = true;
    });

    prevBtn.addEventListener("click", () => {
        index = (index - 1 + deck.length) % deck.length;
        showIndex(index);
    });

    nextBtn.addEventListener("click", () => {
        index = (index + 1) % deck.length;
        showIndex(index);
    });

    const footer = document.createElement("div");
    footer.className = "d-flex justify-content-end gap-2 mt-4";
    const shuffleBtn = document.createElement("button");
    shuffleBtn.className = "btn btn-sm btn-outline-secondary";
    shuffleBtn.textContent = "Перемешать";
    shuffleBtn.addEventListener("click", shuffleDeck);
    const backBtn = document.createElement("button");
    backBtn.className = "btn btn-sm btn-outline-secondary";
    backBtn.textContent = "Назад";
    backBtn.addEventListener("click", onBack);
    footer.appendChild(shuffleBtn);
    footer.appendChild(backBtn);
    container.appendChild(footer);

    showIndex(index);
}

/**
 * Choice: показываем слово и варианты; при неправильном ответе подсвечиваем правильный вариант зеленым.
 *
 * @param {HTMLElement} container
 * @param {Array<{word:string, translation:string}>} words
 * @param {Function} onBack
 */
export function startChoice(container, words, onBack) {
    container.innerHTML = "";

    const title = document.createElement("div");
    title.className = "mb-3";
    title.innerHTML = `<h5 class="mb-0 fw-semibold">Выбрать перевод</h5>`;
    container.appendChild(title);

    const area = document.createElement("div");
    area.className = "d-flex flex-column align-items-stretch gap-3";
    container.appendChild(area);

    const pool = words.map(w => ({ word: String(w.word ?? ""), translation: String(w.translation ?? "") }))
                      .filter(x => x.word && x.translation);

    if (pool.length < 1) {
        area.innerHTML = "<div class='text-muted'>Недостаточно слов.</div>";
        const footerEmpty = document.createElement("div");
        footerEmpty.className = "d-flex justify-content-end mt-3";
        const backBtnEmpty = document.createElement("button");
        backBtnEmpty.className = "btn btn-sm btn-outline-secondary";
        backBtnEmpty.textContent = "Назад";
        backBtnEmpty.addEventListener("click", onBack);
        footerEmpty.appendChild(backBtnEmpty);
        container.appendChild(footerEmpty);
        return;
    }

    let idx = 0;
    let order = shuffle(Array.from(Array(pool.length).keys()));

    function renderRound() {
        area.innerHTML = "";

        if (idx >= order.length) {
            renderPracticeComplete(container, onBack);
            return;
        }

        const item = pool[order[idx]];
        const wordCard = document.createElement("div");
        wordCard.className = "card rounded-4 shadow-sm p-3";
        wordCard.innerHTML = `<div class="fw-semibold h5 mb-2">${escapeHtml(item.word)}</div>`;
        area.appendChild(wordCard);

        const optionsHolder = document.createElement("div");
        optionsHolder.className = "d-grid gap-2";
        area.appendChild(optionsHolder);

        const distractors = pickRandomTranslations(pool, item.translation, 3);
        const options = shuffle([item.translation, ...distractors]);

        options.forEach(opt => {
            const btn = document.createElement("button");
            btn.className = "btn btn-outline-secondary rounded-3 p-3 text-start";
            btn.innerHTML = `<div class="fw-medium">${escapeHtml(opt)}</div>`;
            btn.addEventListener("click", () => {
                [...optionsHolder.querySelectorAll("button")].forEach(b => b.disabled = true);
                if (opt === item.translation) {
                    btn.classList.remove("btn-outline-secondary");
                    btn.classList.add("btn-success");
                } else {
                    btn.classList.remove("btn-outline-secondary");
                    btn.classList.add("btn-danger");
                    const correctBtn = [...optionsHolder.querySelectorAll("button")]
                        .find(b => b.innerText.trim() === item.translation);
                    if (correctBtn) {
                        correctBtn.classList.remove("btn-outline-secondary");
                        correctBtn.classList.add("btn-success");
                    }
                }

                const nextBtn = document.createElement("button");
                nextBtn.className = "btn btn-primary mt-3";
                nextBtn.textContent = "Дальше";
                nextBtn.addEventListener("click", () => {
                    idx++;
                    renderRound();
                });
                area.appendChild(nextBtn);
            });
            optionsHolder.appendChild(btn);
        });
    }

    const footer = document.createElement("div");
    footer.className = "d-flex justify-content-end gap-2 mt-3";
    const backBtn = document.createElement("button");
    backBtn.className = "btn btn-sm btn-outline-secondary";
    backBtn.textContent = "Назад";
    backBtn.addEventListener("click", onBack);
    footer.appendChild(backBtn);
    container.appendChild(footer);

    renderRound();
}

/**
 * Assemble: пользователь собирает слово из букв (пробелы отображаются как видимый символ и тоже кнопка).
 *
 * @param {HTMLElement} container
 * @param {Array<{word:string, translation:string}>} words
 * @param {Function} onBack
 */
export function startAssemble(container, words, onBack) {
    container.innerHTML = "";

    const title = document.createElement("div");
    title.className = "mb-3";
    title.innerHTML = `<h5 class="mb-0 fw-semibold">Составить слово</h5>`;
    container.appendChild(title);

    const area = document.createElement("div");
    area.className = "d-flex flex-column gap-3";
    container.appendChild(area);

    const pool = words.map(w => ({ word: String(w.word ?? ""), translation: String(w.translation ?? "") }))
                      .filter(x => x.word && x.translation);

    if (pool.length < 1) {
        area.innerHTML = "<div class='text-muted'>Недостаточно слов.</div>";
        const footerEmpty = document.createElement("div");
        footerEmpty.className = "d-flex justify-content-end mt-3";
        const backBtnEmpty = document.createElement("button");
        backBtnEmpty.className = "btn btn-sm btn-outline-secondary";
        backBtnEmpty.textContent = "Назад";
        backBtnEmpty.addEventListener("click", onBack);
        footerEmpty.appendChild(backBtnEmpty);
        container.appendChild(footerEmpty);
        return;
    }

    let order = shuffle(Array.from(Array(pool.length).keys()));
    let idx = 0;

    function renderRound() {
        area.innerHTML = "";
        if (idx >= order.length) {
            renderPracticeComplete(container, onBack);
            return;
        }

        const itemRaw = pool[order[idx]];
        const itemWord = removeEmojis(itemRaw.word).trim();
        const displayWord = itemWord;

        const help = document.createElement("div");
        help.className = "card rounded-4 shadow-sm p-3";
        help.innerHTML = `<div class="fw-semibold h5 mb-2">${escapeHtml(itemRaw.translation)}</div>
                          <div class="small text-muted">Соберите слово, нажимая на буквы</div>`;
        area.appendChild(help);

        const chars = Array.from(displayWord);
        const shuffled = shuffle(chars.slice());

        const lettersHolder = document.createElement("div");
        lettersHolder.className = "d-flex flex-wrap gap-2 p-2";
        area.appendChild(lettersHolder);

        const answerHolder = document.createElement("div");
        answerHolder.className = "d-flex flex-column gap-2";

        const inputGroup = document.createElement("div");
        inputGroup.className = "d-flex align-items-center gap-2";

        const answerInput = document.createElement("input");
        answerInput.className = "form-control";
        answerInput.readOnly = true;
        answerInput.placeholder = "Соберите слово";
        answerInput.style.minWidth = "160px";
        inputGroup.appendChild(answerInput);

        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "btn-close";
        clearBtn.setAttribute("aria-label", "Очистить");
        inputGroup.appendChild(clearBtn);

        answerHolder.appendChild(inputGroup);

        const buttonGroup = document.createElement("div");
        buttonGroup.className = "d-flex justify-content-end gap-2";

        const submitBtn = document.createElement("button");
        submitBtn.className = "btn btn-primary btn-sm";
        submitBtn.textContent = "Проверить";
        buttonGroup.appendChild(submitBtn);

        answerHolder.appendChild(buttonGroup);
        area.appendChild(answerHolder);

        const SPACE_SYMBOL = "␣";

        shuffled.forEach((ch, i) => {
            const display = ch === " " ? SPACE_SYMBOL : ch;
            const btn = document.createElement("button");
            btn.className = "btn btn-outline-secondary btn-sm";
            btn.textContent = display;
            btn.dataset.char = ch;
            btn.addEventListener("click", () => {
                const current = answerInput.value;
                answerInput.value = current + (ch === " " ? " " : ch);
                btn.disabled = true;
            });
            lettersHolder.appendChild(btn);
        });

        clearBtn.addEventListener("click", () => {
            answerInput.value = "";
            [...lettersHolder.querySelectorAll("button")].forEach(b => b.disabled = false);
        });

        let showAnswerButton = null;

        submitBtn.addEventListener("click", () => {
            if (submitBtn.textContent === "Далее") {
                idx++;
                renderRound();
                return;
            }

            const submitted = String(answerInput.value ?? "");
            const normalizedSubmitted = normalizeForCompare(submitted);
            const normalizedTarget = normalizeForCompare(itemWord);
            if (!submitted.trim()) {
                return;
            }
            if (normalizedSubmitted === normalizedTarget) {
                idx++;
                renderRound();
            } else {
                if (!showAnswerButton) {
                    showAnswerButton = document.createElement("button");
                    showAnswerButton.className = "btn btn-outline-primary btn-sm";
                    showAnswerButton.textContent = "Показать ответ";
                    showAnswerButton.addEventListener("click", () => {
                        answerInput.value = itemWord;
                        [...lettersHolder.querySelectorAll("button")].forEach(b => b.disabled = true);
                        submitBtn.textContent = "Далее";
                    });
                    buttonGroup.insertBefore(showAnswerButton, submitBtn);
                }
            }
        });
    }

    const footer = document.createElement("div");
    footer.className = "d-flex justify-content-end gap-2 mt-3";
    const backBtn = document.createElement("button");
    backBtn.className = "btn btn-sm btn-outline-secondary";
    backBtn.textContent = "Назад";
    backBtn.addEventListener("click", onBack);
    footer.appendChild(backBtn);
    container.appendChild(footer);

    renderRound();
}

/**
 * Input: пользователь вводит перевод; при ошибке показываем кнопку "Показать ответ".
 *
 * @param {HTMLElement} container
 * @param {Array<{word:string, translation:string}>} words
 * @param {Function} onBack
 */
export function startInput(container, words, onBack) {
    container.innerHTML = "";

    const title = document.createElement("div");
    title.className = "mb-3";
    title.innerHTML = `<h5 class="mb-0 fw-semibold">Вписать перевод</h5>`;
    container.appendChild(title);

    const area = document.createElement("div");
    area.className = "d-flex flex-column gap-3";
    container.appendChild(area);

    const pool = words.map(w => ({ word: String(w.word ?? ""), translation: String(w.translation ?? "") }))
                      .filter(x => x.word && x.translation);

    if (!pool.length) {
        area.innerHTML = "<div class='text-muted'>Нет данных для ввода.</div>";
        const footerEmpty = document.createElement("div");
        footerEmpty.className = "d-flex justify-content-end mt-3";
        const backBtnEmpty = document.createElement("button");
        backBtnEmpty.className = "btn btn-sm btn-outline-secondary";
        backBtnEmpty.textContent = "Назад";
        backBtnEmpty.addEventListener("click", onBack);
        footerEmpty.appendChild(backBtnEmpty);
        container.appendChild(footerEmpty);
        return;
    }

    let order = shuffle(Array.from(Array(pool.length).keys()));
    let idx = 0;

    function renderRound() {
        area.innerHTML = "";
        if (idx >= order.length) {
            renderPracticeComplete(container, onBack);
            return;
        }

        const item = pool[order[idx]];
        const card = document.createElement("div");
        card.className = "card rounded-4 shadow-sm p-3";
        card.innerHTML = `<div class="fw-semibold h5 mb-2">${escapeHtml(item.word)}</div>`;

        const inputGroup = document.createElement("div");
        inputGroup.className = "d-flex align-items-center gap-2 mb-2";

        const input = document.createElement("input");
        input.className = "form-control";
        input.placeholder = "Введите перевод";
        inputGroup.appendChild(input);

        const clearBtn = document.createElement("button");
        clearBtn.type = "button";
        clearBtn.className = "btn-close";
        clearBtn.setAttribute("aria-label", "Очистить");
        inputGroup.appendChild(clearBtn);

        card.appendChild(inputGroup);

        const buttonGroup = document.createElement("div");
        buttonGroup.className = "d-flex justify-content-end gap-2";

        const checkBtn = document.createElement("button");
        checkBtn.className = "btn btn-primary btn-sm";
        checkBtn.textContent = "Проверить";
        buttonGroup.appendChild(checkBtn);

        card.appendChild(buttonGroup);
        area.appendChild(card);

        let showAnswerButton = null;

        function normalize(s) {
            return normalizeForCompare(s);
        }

        clearBtn.addEventListener("click", () => {
            input.value = "";
        });

        checkBtn.addEventListener("click", () => {
            if (checkBtn.textContent === "Далее") {
                idx++;
                renderRound();
                return;
            }

            const ans = normalize(input.value);
            if (!ans) {
                return;
            }
            const correct = normalize(item.translation);
            if (ans === correct) {
                idx++;
                renderRound();
            } else {
                if (!showAnswerButton) {
                    showAnswerButton = document.createElement("button");
                    showAnswerButton.className = "btn btn-outline-primary btn-sm";
                    showAnswerButton.textContent = "Показать ответ";
                    showAnswerButton.addEventListener("click", () => {
                        input.value = item.translation;
                        checkBtn.textContent = "Далее";
                    });
                    buttonGroup.insertBefore(showAnswerButton, checkBtn);
                }
            }
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                checkBtn.click();
            }
        });
    }

    const footer = document.createElement("div");
    footer.className = "d-flex justify-content-end gap-2 mt-3";
    const backBtn = document.createElement("button");
    backBtn.className = "btn btn-sm btn-outline-secondary";
    backBtn.textContent = "Назад";
    backBtn.addEventListener("click", onBack);
    footer.appendChild(backBtn);
    container.appendChild(footer);

    renderRound();
}

/**
 * Показывает финальный экран: "Практика завершена!" и кнопку "Перейти к списку".
 *
 * @param {HTMLElement} container
 * @param {Function} onBack
 */
function renderPracticeComplete(container, onBack) {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "d-flex flex-column align-items-center justify-content-center";
    wrap.style.minHeight = "240px";
    wrap.innerHTML = `
        <div class="h5 fw-semibold text-center mb-3">Практика завершена!</div>
    `;
    const btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.textContent = "Перейти к списку";
    btn.addEventListener("click", onBack);
    wrap.appendChild(btn);
    container.appendChild(wrap);
}

/* ----------------- Utility helpers ----------------- */

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function pickRandomTranslations(pool, exceptTranslation, count) {
    const others = pool.map(p => p.translation).filter(t => t !== exceptTranslation);
    const shuffled = shuffle(others);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}