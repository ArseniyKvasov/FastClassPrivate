import { getIsPreview, showNotification } from "js/tasks/utils.js";
import { sendAnswer } from "classroom/answers/api.js";

function normalizeAnswerString(text) {
    if (typeof text !== 'string') return "";

    let normalized = text.toLowerCase();

    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const replacements = {
        '—': '-', '–': '-', '−': '-', '―': '-',
        '’': "'", '‘': "'", '´': "'", '`': "'",
        '"': "'", '“': "'", '”': "'", '«': "'", '»': "'"
    };

    Object.entries(replacements).forEach(([from, to]) => {
        normalized = normalized.replace(new RegExp(from, 'g'), to);
    });

    normalized = normalized.replace(/,/g, '.');

    const fractionPattern = /\b(\d+)\s*\/\s*(\d+)\b/g;
    normalized = normalized.replace(fractionPattern, (match, num, den) => {
        try {
            const numInt = parseInt(num);
            const denInt = parseInt(den);
            if (denInt !== 0) {
                return (numInt / denInt).toString();
            }
        } catch (e) {}
        return match;
    });

    const numberPattern = /\b\d+\.?\d*\.?\d*\b/g;
    normalized = normalized.replace(numberPattern, (match) => {
        try {
            if (match.includes('.')) {
                return parseFloat(match).toString();
            }
        } catch (e) {}
        return match;
    });

    normalized = normalized.replace(/[^\w\s\'.+-]/g, '');

    normalized = normalized.replace(/\s+/g, ' ').trim();

    const contractions = [
        ['i\\s+am', "i'm"],
        ['was\\s+not', "wasn't"],
        ['were\\s+not', "weren't"],
        ['do\\s+not', "don't"],
        ['does\\s+not', "doesn't"],
        ['did\\s+not', "didn't"],
        ['have\\s+not', "haven't"],
        ['has\\s+not', "hasn't"],
        ['had\\s+not', "hadn't"],
        ['will\\s+not', "won't"],
        ['would\\s+not', "wouldn't"],
        ['should\\s+not', "shouldn't"],
        ['could\\s+not', "couldn't"],
        ['can\\s+not', "can't"],
        ['cannot', "can't"],
        ['must\\s+not', "mustn't"]
    ];

    contractions.forEach(([pattern, replacement]) => {
        const regex = new RegExp(`\\b${pattern}\\b`, 'g');
        normalized = normalized.replace(regex, replacement);
    });

    normalized = normalized.replace(/\s*-\s*/g, '-');

    return normalized;
}

function compareNormalizedAnswers(answer1, answer2) {
    return normalizeAnswerString(answer1) === normalizeAnswerString(answer2);
}

export function updateBadgesStrikethrough(container, answers) {
    const badges = container.querySelectorAll(".badge.bg-primary");
    const usedBadges = new Set();

    badges.forEach(badge => {
        badge.classList.remove("text-decoration-line-through", "bg-secondary");
    });

    Object.values(answers).forEach(answerData => {
        if (answerData?.value && answerData?.is_correct === true) {
            const userAnswerNormalized = normalizeAnswerString(answerData.value);

            const matchingBadge = Array.from(badges).find(badge => {
                const badgeTextNormalized = normalizeAnswerString(badge.textContent);
                const isMatch = badgeTextNormalized === userAnswerNormalized;
                return isMatch && !usedBadges.has(badge);
            });

            if (matchingBadge) {
                matchingBadge.classList.add("text-decoration-line-through", "bg-secondary");
                usedBadges.add(matchingBadge);
            }
        }
    });
}

export function bindAnswerSubmission(container, task) {
    if (!container) return;

    const inputs = container.querySelectorAll(".gap-input");

    const handleSubmit = (input, index) => {
        const value = input.value.trim();
        if (!value) return;

        if (getIsPreview()) {
            showNotification("Нажмите Выбрать чтобы отправить ответ");
            return;
        }

        sendAnswer({
            taskId: task.task_id,
            data: { [`gap-${index}`]: value }
        });
    };

    inputs.forEach((input, index) => {
        input.addEventListener("blur", () => {
            handleSubmit(input, index);
        });

        input.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;

            e.preventDefault();
            handleSubmit(input, index);
            input.blur();
        });
    });
}

export async function handleAnswer(data) {
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

export function clearTask(container) {
    container.querySelectorAll(".gap-input").forEach(input => {
        input.value = "";
        input.disabled = false;
        input.readOnly = false;
        input.classList.remove(
            "bg-success",
            "bg-danger",
            "bg-opacity-25",
            "border",
            "border-success",
            "border-danger",
            "text-white"
        );
    });

    container.querySelectorAll(".badge").forEach(badge => {
        badge.classList.remove("text-decoration-line-through", "bg-secondary");
    });
}