/**
 * Рендер редактора задания "Соотнеси карточки".
 * Если передан taskId — открывает редактор в модальном окне для редактирования.
 * Если container не указан — вставляет редактор в список заданий.
 */
function renderMatchCardsTaskEditor(taskId = null, container = null, taskData = null) {
    const parent = container || document.getElementById("task-list");
    if (!parent) return;

    const card = document.createElement("div");
    card.className = "task-editor-card mb-4 p-3 bg-white border-0 rounded";

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="fw-semibold text-dark mb-0">Соотнеси карточки</h6>
            <button class="btn-close remove-task-btn small" title="Удалить задание"></button>
        </div>

        <div id="match-cards-container" class="mb-3"></div>

        <button class="btn btn-link text-primary fw-semibold mt-3 add-card-btn px-0" style="border:none;">
            <i class="bi bi-plus me-1"></i>Добавить карточку
        </button>

        <button class="btn btn-success mt-2 w-100 fw-semibold">
            Сохранить
        </button>
    `;

    const cardsWrapper = card.querySelector("#match-cards-container");

    card.querySelector(".add-card-btn")
        .addEventListener("click", () => addMatchCard(cardsWrapper));

    card.querySelector(".remove-task-btn")
        .addEventListener("click", () => {
            if (taskId && bootstrapEditorModal) {
                bootstrapEditorModal.hide();
            } else {
                card.remove();
            }
        });

    card.querySelector(".btn-success")
        .addEventListener("click", () => saveTask("match_cards", card, taskId));

    const initialCards = taskData?.cards || [];
    if (initialCards.length > 0) {
        initialCards.forEach(c => addMatchCard(cardsWrapper, c.card_left, c.card_right));
    } else {
        addMatchCard(cardsWrapper);
        addMatchCard(cardsWrapper);
    }

    card.addEventListener("paste", (e) => handleAutoPasteCards(e, cardsWrapper));

    if (taskId) {
        if (!editorModal) {
            editorModal = document.createElement("div");
            editorModal.className = "modal fade";
            editorModal.tabIndex = -1;
            editorModal.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content p-3"></div>
                </div>
            `;
            document.body.appendChild(editorModal);
            bootstrapEditorModal = new bootstrap.Modal(editorModal);
        }
        const content = editorModal.querySelector(".modal-content");
        content.innerHTML = "";
        content.appendChild(card);
        bootstrapEditorModal.show();
        return;
    }

    if (container) {
        parent.innerHTML = "";
        parent.appendChild(card);
    } else {
        parent.appendChild(card);
    }

    card.scrollIntoView({ behavior: "smooth", block: "center" });
}


function addMatchCard(container, leftValue = "", rightValue = "") {
    const cId = generateId("card");

    const row = document.createElement("div");
    row.className = "match-card-row d-flex align-items-center gap-2 mb-2";
    row.dataset.cardId = cId;

    row.innerHTML = `
        <input type="text" class="form-control card-left" placeholder="Левая карточка" style="max-width: 45%;" value="${leftValue}">
        <i class="bi bi-arrow-left-right text-secondary fs-5 swap-card-btn" title="Поменять местами" style="cursor: pointer;"></i>
        <input type="text" class="form-control card-right" placeholder="Правая карточка" style="max-width: 45%;" value="${rightValue}">
        <button class="btn-close remove-card-btn" title="Удалить карточку" style="transform: scale(0.7);"></button>
    `;

    const leftInput = row.querySelector(".card-left");
    const rightInput = row.querySelector(".card-right");
    const swapBtn = row.querySelector(".swap-card-btn");

    // Удаление карточки
    row.querySelector(".remove-card-btn")
        .addEventListener("click", () => row.remove());

    // Смена мест
    swapBtn.addEventListener("click", () => {
        const tmp = leftInput.value;
        leftInput.value = rightInput.value;
        rightInput.value = tmp;
        leftInput.focus();
    });

    // ENTER-навигация
    leftInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            rightInput.focus();
        }
    });

    rightInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();

            const allRows = [...container.querySelectorAll(".match-card-row")];
            const currentIndex = allRows.indexOf(row);
            const nextEmpty = allRows.slice(currentIndex + 1)
                                     .map(r => r.querySelector(".card-left"))
                                     .find(input => !input.value.trim());

            if (nextEmpty) {
                nextEmpty.focus();
            } else {
                const newRow = addMatchCard(container);
                newRow.querySelector(".card-left").focus();
            }
        }
    });

    container.appendChild(row);
    return row;
}

function handleAutoPasteCards(e, container) {
    const clipboardData = (e.clipboardData || window.clipboardData);
    const text = clipboardData?.getData("text/plain");
    if (!text) return;

    if (!/[–—\-]|\t|\s{2,}/.test(text)) return;

    const targetInput = e.target.closest("input");
    if (!targetInput) return;

    e.preventDefault();

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const allRows = [...container.querySelectorAll(".match-card-row")];
    allRows.forEach(row => {
        const left = row.querySelector(".card-left").value.trim();
        const right = row.querySelector(".card-right").value.trim();
        if (row.contains(targetInput) || (!left && !right)) {
            row.remove();
        }
    });

    lines.forEach(line => {
        const parts = line.split(/\s*[-–—]\s*|\t+|\s{2,}/);
        const left = parts[0]?.trim() || "";
        const right = parts[1]?.trim() || "";
        if (left || right) addMatchCard(container, left, right);
    });

    if (container.querySelector(".match-card-row")) {
        showNotification("✅ Карточки успешно вставлены!");
    } else {
        showNotification("❌ Не удалось распознать карточки!");
    }
}
