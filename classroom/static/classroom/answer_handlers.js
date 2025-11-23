/**
 * Модуль для работы с ответами на задания
 * Обеспечивает сохранение и отображение ответов для всех типов заданий
 */

// ==================== СЕТЕВЫЕ ФУНКЦИИ ====================

async function sendAnswer({ taskId, data }) {
    if (!virtualClassId) {
        showNotification("Произошла ошибка. Вы не можете сохранять ответы.");
        return null;
    }

    const url = `/classroom/${virtualClassId}/save-answer/`;
    const payload = {
        task_id: taskId,
        data: data
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCsrfToken()
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

        const result = await response.json();

        if (result.success && result.answer) {
            const taskType = getTaskTypeFromContainer(taskId);
            const responseData = {
                task_id: taskId,
                task_type: taskType,
                answer: result.answer
            };

            const handler = answerHandlers[taskType];
            if (handler) handler(responseData);
        }

        return result;
    } catch (err) {
        console.error("Ошибка при отправке ответа:", err);
        showNotification("Не удалось отправить ответ.");
        return null;
    }
}

async function fetchSectionAnswers(sectionId) {
    const url = `/classroom/get-section-answers/?section_id=${sectionId}&classroom_id=${virtualClassId}&user_id=${currentUserId}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    return data;
}

async function fetchTaskAnswer(taskId) {
    /**
     * Получает данные ответа для задания с сервера
     * Возвращает: { task_id, task_type, answer: {...} }
     */
    if (!virtualClassId) {
        throw new Error("Не указан виртуальный класс");
    }

    const url = `/classroom/get-task-answer/?task_id=${taskId}&classroom_id=${virtualClassId}&user_id=${currentUserId}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (!data?.task_type) {
        throw new Error("Некорректный ответ от сервера");
    }

    return data;
}

// ==================== ОБРАБОТЧИКИ ВВОДА ОТВЕТОВ ====================

const taskHandlers = {
    test: handleTestTask,
    true_false: handleTrueFalseTask,
    text_input: handleTextInputTask,
    fill_gaps: handleFillGapsTask,
    match_cards: handleMatchCardsTask
};

function attachTaskHandler(container, task) {
    const handler = taskHandlers[task.task_type];
    if (handler) handler(container, task);
}

function handleTestTask(container, task) {
    if (!container) return;

    container.querySelectorAll("[data-option-index]").forEach(input => {
        input.addEventListener("change", () => {
            const answers = collectAnswers(task, container);
            sendAnswer({
                taskId: task.task_id,
                data: { answers }
            });
        });
    });
}

function handleTrueFalseTask(container, task) {
    if (!container) return;

    container.querySelectorAll("[data-tf]").forEach(input => {
        input.addEventListener("change", () => {
            const answers = collectAnswers(task, container);
            sendAnswer({
                taskId: task.task_id,
                data: { answers }
            });
        });
    });
}

function handleTextInputTask(container, task) {
    if (!container) return;

    const input = container.querySelector("textarea, input[type='text']");
    if (!input) return;

    const syncValue = (value) => {
        if (input.value !== value) {
            input.value = value;
            if (input.tagName.toLowerCase() === "textarea") {
                adjustTextareaHeight(input);
            }
        }
    };

    input.addEventListener("input", debounce(() => {
        sendAnswer({
            taskId: task.task_id,
            data: { current_text: input.value }
        });
    }, 400));
}

function handleFillGapsTask(container, task) {
    if (!container) return;

    const inputs = container.querySelectorAll(".gap-input");

    inputs.forEach((input, index) => {
        input.addEventListener("blur", () => {
            const value = input.value.trim();

            if (!value) return;

            sendAnswer({
                taskId: task.task_id,
                data: { [`gap-${index}`]: value }
            });
        });
    });
}

function handleMatchCardsTask(container, task) {
    if (!container) return;

    let selectedLeft = null;
    let selectedRight = null;

    const leftButtons = container.querySelectorAll(".left-card");
    const rightButtons = container.querySelectorAll(".right-card");

    const clearSelection = () => {
        selectedLeft?.classList.remove("bg-primary", "text-white");
        selectedRight?.classList.remove("bg-primary", "text-white");
        selectedLeft = null;
        selectedRight = null;
    };

    const selectPair = () => {
        if (selectedLeft && selectedRight) {
            sendAnswer({
                taskId: task.task_id,
                data: {
                    selected_pair: {
                        card_left: selectedLeft.dataset.left,
                        card_right: selectedRight.dataset.right
                    }
                }
            }).finally(clearSelection);
        }
    };

    leftButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            if (btn.disabled) return;
            if (selectedLeft) selectedLeft.classList.remove("bg-primary", "text-white");
            selectedLeft = btn;
            selectedLeft.classList.add("bg-primary", "text-white");
            selectPair();
        });
    });

    rightButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            if (btn.disabled) return;
            if (selectedRight) selectedRight.classList.remove("bg-primary", "text-white");
            selectedRight = btn;
            selectedRight.classList.add("bg-primary", "text-white");
            selectPair();
        });
    });
}

// ==================== ОТОБРАЖЕНИЕ ОТВЕТОВ ====================

const answerHandlers = {
    test: handleTestAnswer,
    true_false: handleTrueFalseAnswer,
    text_input: handleTextInputAnswer,
    fill_gaps: handleFillGapsAnswer,
    match_cards: handleMatchCardsAnswer
};

async function handleSectionAnswers(sectionId) {
    if (!virtualClassId) {
        showNotification("Произошла ошибка. Не указан виртуальный класс.");
        return;
    }

    try {
        const data = await fetchSectionAnswers(sectionId);

        if (!data || !Array.isArray(data.answers)) {
            showNotification("Нет данных для отображения.");
            return;
        }

        data.answers.forEach(answerData => {
            const { task_id, task_type, answer } = answerData;

            const container = document.querySelector(`[data-task-id="${task_id}"]`);
            if (!container) {
                console.warn(`Контейнер не найден для task_id: ${task_id}`);
                return;
            }

            const handler = answerHandlers[task_type];
            if (typeof handler === "function") {
                try {
                    handler(answerData);
                } catch (error) {
                    console.warn(`Ошибка в обработчике для task_type ${task_type}, task_id ${task_id}:`, error);
                    showNotification("Не удалось отобразить ответ.");
                }
            } else {
                console.warn(`Не найден обработчик для типа задания: ${task_type}`);
                showNotification("Не удалось отобразить ответ.");
            }
        });

    } catch (error) {
        console.warn("Ошибка в handleSectionAnswers:", error);
        showNotification("Не удалось загрузить ответы раздела.");
    }
}

async function handleTestAnswer(data) {
    /**
     * Обрабатывает ответ на тестовое задание
     * @param {Object} data - Данные ответа
     * @param {string} data.task_id - ID задания
     * @param {string} data.task_type - Тип задания (должен быть "test")
     * @param {Object} data.answer - Данные ответа
     * @param {Array} data.answer.answers - Массив ответов на вопросы
     * @param {number} data.answer.answers[].question_index - Индекс вопроса
     * @param {number} data.answer.answers[].selected_option - Выбранный вариант
     * @param {boolean} data.answer.answers[].is_correct - Правильность ответа
     * @param {boolean} data.answer.is_checked - Проверен ли ответ
     */
    try {
        if (!data || data.task_type !== "test") return;

        const answers = data.answer?.answers || [];
        const isChecked = data.answer?.is_checked ?? false;

        const container = document.querySelector(`[data-task-id="${data.task_id}"]`);
        if (!container) return;

        container.dataset.isChecked = isChecked.toString();

        container.querySelectorAll("[data-option-index]").forEach(el => {
            const qIndex = Number(el.dataset.questionIndex);
            const oIndex = Number(el.dataset.optionIndex);

            const answerForQ = answers.find(a => a.question_index === qIndex) || {};
            const selectedIdx = answerForQ.selected_option;
            const correct = answerForQ.is_correct;
            const isSelected = selectedIdx === oIndex;

            if (el.tagName.toLowerCase() === "input" && el.type === "radio") {
                el.checked = isSelected;
            }

            if (isChecked) {
                el.disabled = true;
                el.classList.remove("bg-success", "bg-danger", "text-white", "fw-bold");

                if (isSelected) {
                    if (correct) {
                        el.classList.add("bg-success", "text-white", "fw-bold");
                        if (el.tagName.toLowerCase() === "input" && el.type === "radio") {
                            el.style.border = "none";
                            el.style.outline = "none";
                            el.style.borderColor = "#198754";
                            el.style.boxShadow = "none";
                        }
                    } else {
                        el.classList.add("bg-danger", "text-white");
                        if (el.tagName.toLowerCase() === "input" && el.type === "radio") {
                            el.style.border = "none";
                            el.style.outline = "none";
                            el.style.borderColor = "#dc3545";
                            el.style.boxShadow = "none";
                        }
                    }
                } else {
                    if (el.tagName.toLowerCase() === "input" && el.type === "radio") {
                        el.style.border = "";
                        el.style.outline = "";
                        el.style.borderColor = "";
                        el.style.boxShadow = "";
                    }
                }
            } else {
                el.disabled = false;
                el.classList.remove("bg-success", "bg-danger", "text-white", "fw-bold");
                if (el.tagName.toLowerCase() === "input" && el.type === "radio") {
                    el.style.border = "";
                    el.style.outline = "";
                    el.style.borderColor = "";
                    el.style.boxShadow = "";
                }
            }
        });

        const checkBtn = container.querySelector("button.btn-primary");
        if (checkBtn) {
            checkBtn.style.display = isChecked ? "none" : "";
        }

        try {
            initCheckButton(data, container, currentUserId, virtualClassId);
        } catch (err) {
            console.error("Не удалось инициализировать кнопку checkButton: ", err);
        }
    } catch (error) {
        console.error(`Ошибка в handleTestAnswer для task ${data.task_id}:`, error);
        showNotification("Не удалось отобразить ответ.");
    }
}

async function handleTrueFalseAnswer(data) {
    /**
     * Обрабатывает ответ на задание true/false
     * @param {Object} data - Данные ответа
     * @param {string} data.task_id - ID задания
     * @param {string} data.task_type - Тип задания (должен быть "true_false")
     * @param {Object} data.answer - Данные ответа
     * @param {Array} data.answer.answers - Массив ответов на утверждения
     * @param {number} data.answer.answers[].statement_index - Индекс утверждения
     * @param {boolean} data.answer.answers[].selected_value - Выбранное значение
     * @param {boolean} data.answer.answers[].is_correct - Правильность ответа
     * @param {boolean} data.answer.is_checked - Проверен ли ответ
     */
    try {
        if (!data || data.task_type !== "true_false") return;

        const answers = data.answer?.answers || [];
        const isChecked = data.answer?.is_checked ?? false;

        const container = document.querySelector(`[data-task-id="${data.task_id}"]`);
        if (!container) return;

        container.dataset.isChecked = isChecked.toString();

        container.querySelectorAll("[data-tf]").forEach(el => {
            const sIndex = Number(el.dataset.statementIndex);
            const answerForS = answers.find(a => a.statement_index === sIndex) || {};
            const selectedValue = answerForS.selected_value;
            const correct = answerForS.is_correct;

            const tf = el.dataset.tf === "true";
            const isSelected = selectedValue !== null && tf === selectedValue;

            if (isChecked) {
                el.disabled = true;
                el.readOnly = true;

                if (isSelected) {
                    if (correct) {
                        el.classList.remove("bg-danger");
                        el.classList.add("bg-success", "text-white", "fw-bold");
                        if (el.tagName.toLowerCase() === "input") {
                            el.style.border = "none";
                            el.style.outline = "none";
                            el.style.borderColor = "#198754";
                            el.style.boxShadow = "none";
                        }
                    } else {
                        el.classList.remove("bg-success", "fw-bold");
                        el.classList.add("bg-danger", "text-white");
                        if (el.tagName.toLowerCase() === "input") {
                            el.style.border = "none";
                            el.style.outline = "none";
                            el.style.borderColor = "#dc3545";
                            el.style.boxShadow = "none";
                        }
                    }
                } else {
                    el.classList.remove("bg-success", "bg-danger", "text-white", "fw-bold");
                    if (el.tagName.toLowerCase() === "input") {
                        el.style.border = "";
                        el.style.outline = "";
                        el.style.borderColor = "";
                        el.style.boxShadow = "";
                    }
                }
            } else {
                el.disabled = false;
                el.readOnly = false;
                el.classList.remove("bg-success", "bg-danger", "text-white", "fw-bold");
                if (el.tagName.toLowerCase() === "input") {
                    el.style.border = "";
                    el.style.outline = "";
                    el.style.borderColor = "";
                    el.style.boxShadow = "";
                }
            }

            if (el.tagName.toLowerCase() === "input" && (el.type === "radio" || el.type === "checkbox")) {
                el.checked = isSelected;
            }
        });

        const checkBtn = container.querySelector("button.btn-primary");
        if (checkBtn) {
            checkBtn.style.display = isChecked ? "none" : "";
        }

        try {
            initCheckButton(data, container, currentUserId, virtualClassId);
        } catch (err) {
            console.error("Не удалось инициализировать кнопку checkButton: ", err);
        }
    } catch (error) {
        console.error(`Ошибка в handleTrueFalseAnswer для task ${data.task_id}:`, error);
        showNotification("Не удалось отобразить ответ.");
    }
}

async function handleTextInputAnswer(data) {
    /**
     * Обрабатывает ответ на задание с текстовым вводом
     * @param {Object} data - Данные ответа
     * @param {string} data.task_id - ID задания
     * @param {string} data.task_type - Тип задания (должен быть "text_input")
     * @param {Object} data.answer - Данные ответа
     * @param {string} data.answer.current_text - Текст ответа
     * @param {boolean} data.answer.is_checked - Проверен ли ответ
     */
    try {
        if (!data || data.task_type !== "text_input") return;

        const serverText = data.answer?.current_text ?? "";
        const isChecked = data.answer?.is_checked ?? false;

        const container = document.querySelector(`[data-task-id="${data.task_id}"]`);
        if (!container) return;

        const textarea = container.querySelector("textarea, input[type='text']");
        if (!textarea) return;

        if (textarea.value !== serverText) {
            textarea.value = serverText;
            if (textarea.tagName.toLowerCase() === "textarea") {
                adjustTextareaHeight(textarea);
            }
        }

        textarea.disabled = isChecked;
        textarea.readOnly = isChecked;
    } catch (error) {
        console.error(`Ошибка в handleTextInputAnswer для task ${data.task_id}:`, error);
        showNotification("Не удалось отобразить ответ.");
    }
}

async function handleFillGapsAnswer(data) {
    try {
        if (!data || data.task_type !== "fill_gaps") return;

        const answers = data.answer?.answers ?? {};

        const container = document.querySelector(`[data-task-id="${data.task_id}"]`);
        if (!container) return;

        updateBadgesStrikethrough(container, answers);

        container.querySelectorAll(".gap-input").forEach((input, index) => {
            const answerData = answers[index];
            const serverValue = answerData?.value || "";
            const isCorrect = answerData?.is_correct;
            const currentIsCorrect = input.classList.contains("bg-success");
            const currentIsWrong = input.classList.contains("bg-danger");

            if (input.value !== serverValue) {
                input.value = serverValue;
            }

            if (!serverValue.trim()) {
                input.classList.remove("bg-success", "bg-danger", "bg-opacity-25", "border", "border-success", "border-danger", "text-white");
                input.disabled = false;
                input.readOnly = false;
                return;
            }

            if (isCorrect === true && !currentIsCorrect) {
                input.classList.add("bg-success", "bg-opacity-25", "border", "border-success", "text-white");
                input.classList.remove("bg-danger", "bg-opacity-25", "border-danger");
                input.disabled = true;
                input.readOnly = true;
            } else if (isCorrect === false && !currentIsWrong) {
                input.classList.add("bg-danger", "bg-opacity-25", "border", "border-danger", "text-white");
                input.classList.remove("bg-success", "bg-opacity-25", "border-success");
                input.disabled = false;
                input.readOnly = false;
            } else if (isCorrect === null) {
                input.classList.remove("bg-success", "bg-danger", "bg-opacity-25", "border", "border-success", "border-danger", "text-white");
                input.disabled = false;
                input.readOnly = false;
            }
        });
    } catch (error) {
        console.error(`Ошибка в handleFillGapsAnswer для task ${data.task_id}:`, error);
        showNotification("Не удалось отобразить ответ.");
    }
}

async function handleMatchCardsAnswer(data) {
    /**
     * Обрабатывает ответ на задание с сопоставлением карточек
     * @param {Object} data - Данные ответа
     * @param {string} data.task_id - ID задания
     * @param {string} data.task_type - Тип задания (должен быть "match_cards")
     * @param {Object} data.answer - Данные ответа
     * @param {Object} data.answer.answers - Объект с сопоставлениями карточек
     * @param {string} data.answer.answers[].card_right - Сопоставленная правая карточка
     * @param {boolean} data.answer.answers[].is_correct - Правильность сопоставления
     */
    try {
        if (!data || data.task_type !== "match_cards" || !data.answer) return;

        const answers = data.answer.answers ?? {};

        const container = document.querySelector(`[data-task-id="${data.task_id}"]`);
        if (!container) return;

        const leftButtons = Array.from(container.querySelectorAll(".left-card"));
        const rightButtons = Array.from(container.querySelectorAll(".right-card"));

        const currentStates = new Map();
        leftButtons.forEach(btn => {
            const isSuccess = btn.classList.contains("bg-success");
            currentStates.set(btn.dataset.left, { isSuccess });
        });

        Object.entries(answers).forEach(([leftCard, answerData]) => {
            const leftBtn = leftButtons.find(btn => btn.dataset.left === leftCard);
            const rightBtn = rightButtons.find(btn => btn.dataset.right === answerData.card_right);
            const isCorrect = answerData.is_correct;
            const currentState = currentStates.get(leftCard);

            if (leftBtn && rightBtn) {
                if (isCorrect === true) {
                    if (!currentState?.isSuccess) {
                        leftBtn.classList.remove("bg-primary", "bg-danger", "border-1");
                        rightBtn.classList.remove("bg-primary", "bg-danger", "border-1");
                        leftBtn.classList.add("bg-success", "text-light", "fw-bold", "border-0");
                        rightBtn.classList.add("bg-success", "text-light", "fw-bold", "border-0");
                    }
                    leftBtn.disabled = true;
                    rightBtn.disabled = true;
                } else {
                    leftBtn.classList.remove("bg-primary", "bg-success", "bg-danger", "text-light", "fw-bold", "border-0");
                    rightBtn.classList.remove("bg-primary", "bg-success", "bg-danger", "text-light", "fw-bold", "border-0");
                    leftBtn.classList.add("border-1");
                    rightBtn.classList.add("border-1");
                    leftBtn.disabled = false;
                    rightBtn.disabled = false;
                }
            }
        });

        leftButtons.forEach(btn => {
            if (!answers[btn.dataset.left]) {
                btn.classList.remove("bg-primary", "bg-success", "bg-danger", "text-light", "fw-bold", "border-0");
                btn.classList.add("border-1");
                btn.disabled = false;
            }
        });
        rightButtons.forEach(btn => {
            const hasMatch = Object.values(answers).some(answer => answer.card_right === btn.dataset.right);
            if (!hasMatch) {
                btn.classList.remove("bg-primary", "bg-success", "bg-danger", "text-light", "fw-bold", "border-0");
                btn.classList.add("border-1");
                btn.disabled = false;
            }
        });
    } catch (error) {
        console.error(`Ошибка в handleMatchCardsAnswer для task ${data.task_id}:`, error);
        showNotification("Не удалось отобразить ответ.");
    }
}

// ==================== УТИЛИТЫ ====================

function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function adjustTextareaHeight(textarea) {
    textarea.rows = 2;
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    const lines = Math.ceil(textarea.scrollHeight / lineHeight);
    textarea.rows = Math.min(Math.max(lines, 2), 8);
}

function getTaskTypeFromContainer(taskId) {
    const container = document.querySelector(`[data-task-id="${taskId}"]`);
    return container?.dataset?.taskType;
}

function updateBadgesStrikethrough(container, answers) {
    const badges = container.querySelectorAll(".badge.bg-primary");
    const usedBadges = new Set();

    badges.forEach(badge => {
        badge.classList.remove("text-decoration-line-through", "bg-secondary");
    });

    Object.values(answers).forEach(answerData => {
        if (answerData?.value && answerData?.is_correct === true) {
            const answerValue = answerData.value.trim().toLowerCase();
            const matchingBadge = Array.from(badges).find(badge =>
                badge.textContent.trim().toLowerCase() === answerValue &&
                !usedBadges.has(badge)
            );

            if (matchingBadge) {
                matchingBadge.classList.add("text-decoration-line-through", "bg-secondary");
                usedBadges.add(matchingBadge);
            }
        }
    });
}

function collectAnswers(task, container) {
    const answers = [];
    if (!container || !task) return answers;

    if (task.task_type === "test") {
        const forms = container.querySelectorAll('form[data-question-index]');
        forms.forEach(form => {
            const qIndex = Number(form.dataset.questionIndex);
            const selected = form.querySelector('input[type="radio"]:checked');
            answers.push({
                question_index: qIndex,
                selected_option: selected ? Number(selected.dataset.optionIndex) : null
            });
        });
    } else if (task.task_type === "true_false") {
        const forms = container.querySelectorAll('form[data-statement-index]');
        forms.forEach(form => {
            const sIndex = Number(form.dataset.statementIndex);
            const selected = form.querySelector('input[type="radio"]:checked');
            answers.push({
                statement_index: sIndex,
                selected_value: selected ? (selected.dataset.tf === 'true') : null
            });
        });
    }
    return answers;
}

function initCheckButton(task, container, userId, classroomId) {
    const checkBtn = container.querySelector("button.btn-primary");
    if (!checkBtn) return;

    function allFormsAnswered() {
        const forms = Array.from(container.querySelectorAll("form"));
        if (!forms.length) return false;
        return forms.every(f => f.querySelector('input[type="radio"]:checked') !== null);
    }

    function updateButtonState() {
        const isChecked = container.dataset.isChecked === "true";
        checkBtn.disabled = !allFormsAnswered() || isChecked;
    }

    container.querySelectorAll("form").forEach(form => {
        form.addEventListener("change", updateButtonState);
    });

    updateButtonState();

    checkBtn.addEventListener("click", async () => {
        if (checkBtn.disabled) return;

        const answers = collectAnswers(task, container);
        if (!answers.length) return;

        checkBtn.disabled = true;

        try {
            const response = await fetch(`/classroom/${classroomId}/mark-answer-as-checked/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCsrfToken()
                },
                body: JSON.stringify({
                    task_id: task.task_id,
                    user_id: userId,
                    answers
                })
            });

            const result = await response.json();
            if (result.success) {
                container.dataset.isChecked = "true";

                if (task.task_type === "test" && typeof handleTestAnswer === "function") {
                    const data = fetchTaskAnswer(task.task_id);
                    handleTestAnswer(data);
                } else if (task.task_type === "true_false" && typeof handleTrueFalseAnswer === "function") {
                    const data = fetchTaskAnswer(task.task_id);
                    handleTrueFalseAnswer(data);
                }
            } else {
                console.error(result.errors);
                checkBtn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            checkBtn.disabled = false;
        }
    });
}
