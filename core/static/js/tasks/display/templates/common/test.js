import { formatLatex } from "js/tasks/editor/textFormatting.js";

/**
 * Рендерит тестовую задачу и форму для каждого вопроса.
 *
 * task: {
 *     id: string,
 *     questions: [
 *         { question: string, options: [{ option: string, is_correct: boolean }] }
 *     ]
 * }
 */
export function renderTestTask(task, container) {
    if (!container) return;
    container.innerHTML = "";

    if (!Array.isArray(task.data.questions) || !task.data.questions.length) {
        const empty = document.createElement("div");
        empty.className = "text-danger";
        empty.textContent = "Нет вопросов для отображения.";
        container.appendChild(empty);
        return;
    }

    task.data.questions.forEach((q, qIndex) => {
        const questionDiv = document.createElement("div");
        questionDiv.className = "test-question fw-semibold mb-2";
        
        const questionFragment = formatLatex(q.question);
        questionDiv.innerHTML = "";
        questionDiv.appendChild(questionFragment);

        container.appendChild(questionDiv);

        const form = document.createElement("form");
        form.className = "test-options mb-3";
        form.dataset.questionIndex = String(qIndex);

        q.options.forEach((option, oIndex) => {
            const optionDiv = document.createElement("div");
            optionDiv.className = "form-check mb-2";

            const input = document.createElement("input");
            input.className = "form-check-input";
            input.type = "radio";
            input.name = `test-${task.task_id}-q${qIndex}`;
            input.id = `test-${task.task_id}-q${qIndex}-o${oIndex}`;
            input.dataset.optionIndex = String(oIndex);
            input.dataset.questionIndex = String(qIndex);

            const label = document.createElement("label");
            label.className = "form-check-label";
            label.htmlFor = input.id;

            const optionFragment = formatLatex(option.option);
            label.innerHTML = "";
            label.appendChild(optionFragment);

            optionDiv.appendChild(input);
            optionDiv.appendChild(label);
            form.appendChild(optionDiv);
        });

        container.appendChild(form);
    });

    const checkBtn = document.createElement("button");
    checkBtn.type = "button";
    checkBtn.className = "btn btn-primary mt-3 check-task-btn";
    checkBtn.textContent = "Проверить";
    checkBtn.style.display = "none";
    container.appendChild(checkBtn);

    if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([container]).catch(() => {});
    }
}