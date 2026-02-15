import { getIsPreview, showNotification } from "js/tasks/utils.js";
import { sendAnswer } from "classroom/answers/api.js";

/**
 * Навешивает обработчики на карточки match-cards
 * @param {HTMLElement} container
 * @param {Object} task
 */
export function bindAnswerSubmission(container, task) {
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
            if (getIsPreview()) {
                showNotification("Нажмите Выбрать чтобы отправить ответ");
                clearSelection();
                return;
            }

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
            selectedLeft?.classList.remove("bg-primary", "text-white");
            selectedLeft = btn;
            selectedLeft.classList.add("bg-primary", "text-white");
            selectPair();
        });
    });

    rightButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            if (btn.disabled) return;
            selectedRight?.classList.remove("bg-primary", "text-white");
            selectedRight = btn;
            selectedRight.classList.add("bg-primary", "text-white");
            selectPair();
        });
    });
}

export async function handleAnswer(data) {
    /**
     * Обрабатывает визуальное отображение ответов для задания типа "match_cards"
     *
     * Функция анализирует полученные данные ответа и соответствующим образом обновляет
     * стили карточек в интерфейсе:
     * - Правильно сопоставленные карточки отмечаются зеленым цветом и блокируются
     * - Неправильно сопоставленные карточки возвращаются в исходное состояние
     * - Последняя неправильная пара временно подсвечивается анимацией
     *
     * @param {Object} data - Объект с данными ответа
     * @param {string} data.task_id - Уникальный идентификатор задания
     * @param {string} data.task_type - Тип задания (должен быть "match_cards")
     * @param {Object} data.answer - Данные ответа пользователя
     * @param {Object} data.answer.answers - Объект с информацией о сопоставлениях
     * @param {Object} data.answer.answers[leftCardId] - Данные для конкретной левой карточки
     * @param {string} data.answer.answers[leftCardId].card_right - ID сопоставленной правой карточки
     * @param {boolean|null} data.answer.answers[leftCardId].is_correct - Флаг правильности сопоставления
     * @param {Object} [data.answer.last_pair] - Информация о последней неправильной паре для подсветки
     * @param {string} data.answer.last_pair.card_left - ID левой карточки последней неправильной пары
     * @param {string} data.answer.last_pair.card_right - ID правой карточки последней неправильной пары
     * @returns {Promise<void>}
     */
    try {
        if (!data || data.task_type !== "match_cards" || !data.answer) return;

        const container = document.querySelector(`[data-task-id="${data.task_id}"]`);
        if (!container) return;

        if (container.lastPairTimer) {
            clearTimeout(container.lastPairTimer);
            container.lastPairTimer = null;
        }

        const leftButtons = Array.from(container.querySelectorAll(".left-card"));
        const rightButtons = Array.from(container.querySelectorAll(".right-card"));
        const { answers, last_pair } = data.answer;

        leftButtons.forEach(btn => {
            btn.classList.remove("btn-success", "fw-bold", "btn-danger", "flash-animation", "disabled");
            btn.classList.add("btn-outline-secondary");
            btn.disabled = false;
        });

        rightButtons.forEach(btn => {
            btn.classList.remove("btn-success", "fw-bold", "btn-danger", "flash-animation", "disabled");
            btn.classList.add("btn-outline-secondary");
            btn.disabled = false;
        });

        Object.entries(answers).forEach(([leftCard, answerData]) => {
            if (answerData.is_correct === true) {
                const leftBtn = leftButtons.find(btn => btn.dataset.left === leftCard);
                const rightBtn = rightButtons.find(btn => btn.dataset.right === answerData.card_right);

                if (leftBtn && rightBtn) {
                    leftBtn.classList.remove("btn-outline-secondary");
                    leftBtn.classList.add("btn-success", "fw-bold");
                    leftBtn.disabled = true;

                    rightBtn.classList.remove("btn-outline-secondary");
                    rightBtn.classList.add("btn-success", "fw-bold");
                    rightBtn.disabled = true;
                }
            }
        });

        if (last_pair) {
            const { card_left: left, card_right: right } = last_pair;
            const leftBtn = leftButtons.find(btn => btn.dataset.left === left);
            const rightBtn = rightButtons.find(btn => btn.dataset.right === right);

            if (leftBtn && rightBtn && !leftBtn.disabled && !rightBtn.disabled) {
                leftBtn.classList.remove("btn-outline-secondary");
                leftBtn.classList.add("btn-danger", "flash-animation", "disabled");
                rightBtn.classList.remove("btn-outline-secondary");
                rightBtn.classList.add("btn-danger", "flash-animation", "disabled");

                container.lastPairTimer = setTimeout(() => {
                    if (!leftBtn.classList.contains("btn-success")) {
                        leftBtn.classList.remove("btn-danger", "flash-animation", "disabled");
                        leftBtn.classList.add("btn-outline-secondary");
                    }
                    if (!rightBtn.classList.contains("btn-success")) {
                        rightBtn.classList.remove("btn-danger", "flash-animation", "disabled");
                        rightBtn.classList.add("btn-outline-secondary");
                    }
                    container.lastPairTimer = null;
                }, 1500);
            }
        }
    } catch (error) {
        console.error("Error processing match cards answer:", error);
    }
}

export function clearTask(container) {
    if (container.lastPairTimer) {
        clearTimeout(container.lastPairTimer);
        container.lastPairTimer = null;
    }

    container.querySelectorAll(".left-card, .right-card").forEach(btn => {
        btn.disabled = false;
        btn.classList.remove(
            "btn-success",
            "btn-danger",
            "fw-bold",
            "flash-animation",
            "disabled"
        );
        btn.classList.add("btn-outline-secondary");
    });
}