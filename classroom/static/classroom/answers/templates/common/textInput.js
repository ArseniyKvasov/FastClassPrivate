import { debounce, adjustTextareaHeight } from "/static/classroom/answers/utils.js";
import { sendAnswer } from "/static/classroom/answers/api.js";

let isApplyingServerUpdate = false;

export function bindAnswerSubmission(container, task) {
    if (!container) return;

    const editor = container.querySelector("div[contenteditable='true']");
    if (!editor) return;

    const sendEditorAnswer = debounce(() => {
        if (isApplyingServerUpdate) return;

        sendAnswer({
            taskId: task.task_id,
            data: { current_text: editor.innerHTML }
        });
    }, 400);

    editor.addEventListener("input", sendEditorAnswer);
}

export async function handleAnswer(data) {
    if (!data || data.task_type !== "text_input") return;
    if (data.answer === null) return;

    const taskId = data.task_id;
    const serverHTML = data.answer?.current_text ?? "";
    const isChecked = data.answer?.is_checked ?? false;

    const container = document.querySelector(`[data-task-id="${taskId}"]`);
    if (!container) return;

    const editor = container.querySelector("div[contenteditable='true']");
    if (!editor) return;

    const currentHTML = editor.innerHTML;

    if (currentHTML === serverHTML) {
        editor.contentEditable = !isChecked;
        return;
    }

    isApplyingServerUpdate = true;

    try {
        const userIsTyping = document.activeElement === editor;

        if (userIsTyping) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const rangeClone = range.cloneRange();
                rangeClone.selectNodeContents(editor);
                rangeClone.setEnd(range.endContainer, range.endOffset);
                const cursorPosition = rangeClone.toString().length;

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = currentHTML;
                const currentText = tempDiv.textContent;
                const serverText = document.createElement('div');
                serverText.innerHTML = serverHTML;
                const serverPlainText = serverText.textContent;

                if (cursorPosition > 0) {
                    const prefix = currentText.substring(0, cursorPosition);
                    const serverPrefix = serverPlainText.substring(0, cursorPosition);

                    if (prefix !== serverPrefix) {
                        isApplyingServerUpdate = false;
                        return;
                    }
                }
            }
        }

        editor.innerHTML = serverHTML;

        editor.contentEditable = !isChecked;

    } finally {
        setTimeout(() => {
            isApplyingServerUpdate = false;
        }, 50);
    }
}

export function clearTask(container) {
    const editor = container.querySelector("div[contenteditable='true']");
    if (!editor) return;

    editor.contentEditable = true;
    editor.disabled = false;

    editor.innerHTML = editor.getAttribute("data-default-text") || "";
}