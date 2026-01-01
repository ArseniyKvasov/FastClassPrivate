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

async function initCheckButton(task, container, classroomId) {
    const checkBtn = container.querySelector("button.btn-primary");
    if (!checkBtn) return;

    function allFormsAnswered() {
        const forms = Array.from(container.querySelectorAll("form"));
        if (!forms.length) return false;
        return forms.every(f => f.querySelector('input[type="radio"]:checked') !== null);
    }

    function updateButtonState() {
        const isChecked = container.dataset.isChecked === "true";
        checkBtn.disabled = !allFormsAnswered() || isChecked || getId() === "all";
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
                    user_id: getId(),
                    answers
                })
            });

            const result = await response.json();

            if (result.success) {
                container.dataset.isChecked = "true";

                if (task.task_type === "test" && typeof handleTestAnswer === "function") {
                    const data = await fetchTaskAnswer(task.task_id);
                    handleTestAnswer(data);
                } else if (task.task_type === "true_false" && typeof handleTrueFalseAnswer === "function") {
                    const data = await fetchTaskAnswer(task.task_id);
                    handleTrueFalseAnswer(data);
                }

                notifyAnswerSubmitted(task.task_id);
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